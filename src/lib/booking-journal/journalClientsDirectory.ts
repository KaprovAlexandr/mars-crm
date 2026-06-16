import type { ClientStorageRow } from "@/lib/data/clientsDataSource";
import type { Car, Client } from "@/lib/booking-journal/bookingClientsSearch";
import { national10FromAnyPhoneString } from "@/lib/booking-journal/ruPhoneMask";

const CLIENT_CARS_SHARED_STORAGE_KEY = "clientCarsSharedByFioV1";

function normalizeRuFio(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function readSharedCarsByFio(): Record<string, Array<{ car: string; plate: string }>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(CLIENT_CARS_SHARED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Array<{ car: string; plate: string }>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildCarsForClient(row: ClientStorageRow, sharedCars: Array<{ car: string; plate: string }>): Car[] {
  const cars: Car[] = [];
  const mainCar = (row.car ?? "").trim();
  const mainPlate = (row.plate ?? "").trim();
  if (mainCar) {
    cars.push({ id: `${row.id}c-main`, model: mainCar, plate: mainPlate });
  }
  for (const [idx, shared] of sharedCars.entries()) {
    const model = (shared?.car ?? "").trim();
    if (!model) continue;
    const plate = (shared?.plate ?? "").trim();
    const exists = cars.some((item) => item.model.toLowerCase() === model.toLowerCase());
    if (!exists) cars.push({ id: `${row.id}c-shared-${idx}`, model, plate });
  }
  if (cars.length === 0) {
    cars.push({ id: `${row.id}c-empty`, model: "Автомобиль не указан", plate: "" });
  }
  return cars;
}

export function mapStorageRowToJournalClient(row: ClientStorageRow): Client {
  const sharedByFio = readSharedCarsByFio();
  const fioKey = normalizeRuFio(row.full_name);
  const sharedCars = Array.isArray(sharedByFio[fioKey]) ? sharedByFio[fioKey] : [];
  return {
    id: row.id,
    name: row.full_name,
    phone: row.phone,
    cars: buildCarsForClient(row, sharedCars),
  };
}

export function mergeApiClientsIntoJournalClients(existing: Client[], apiRows: ClientStorageRow[]): Client[] {
  const merged = existing.map((client) => ({
    ...client,
    cars: client.cars.map((car) => ({ ...car })),
  }));
  const byId = new Map(merged.map((client) => [client.id, client]));
  const byPhone = new Map(
    merged
      .map((client) => [national10FromAnyPhoneString(client.phone), client] as const)
      .filter(([phone]) => phone.length === 10),
  );

  for (const row of apiRows) {
    const mapped = mapStorageRowToJournalClient(row);
    const phoneKey = national10FromAnyPhoneString(mapped.phone);
    const existingClient = byId.get(mapped.id) ?? (phoneKey ? byPhone.get(phoneKey) : undefined);
    if (existingClient) {
      const idx = merged.findIndex((client) => client.id === existingClient.id);
      if (idx < 0) continue;
      const carModels = new Set(merged[idx].cars.map((car) => car.model.toLowerCase()));
      const nextCars = [...merged[idx].cars];
      for (const car of mapped.cars) {
        if (carModels.has(car.model.toLowerCase())) continue;
        carModels.add(car.model.toLowerCase());
        nextCars.push(car);
      }
      merged[idx] = {
        ...merged[idx],
        name: mapped.name || merged[idx].name,
        phone: mapped.phone || merged[idx].phone,
        cars: nextCars,
      };
      continue;
    }
    merged.push(mapped);
    byId.set(mapped.id, mapped);
    if (phoneKey.length === 10) byPhone.set(phoneKey, mapped);
  }

  return merged;
}

export function mergeJournalClientLists(base: Client[], extra: Client[]): Client[] {
  const pseudoRows: ClientStorageRow[] = extra.map((client) => ({
    id: client.id,
    full_name: client.name,
    phone: client.phone,
    requests_count: 0,
    last_visit: "",
    total_amount: "",
    car: client.cars[0]?.model ?? "",
    plate: client.cars[0]?.plate ?? "",
  }));
  return mergeApiClientsIntoJournalClients(base, pseudoRows);
}
