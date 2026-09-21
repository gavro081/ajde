import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ userId: "driver" as string | null, rows: [] as Record<string, unknown>[], inserts: 0 }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: fixture.userId ? { id: fixture.userId } : null } }) },
    from: (table: string) => {
      const filters: Array<[string, unknown]> = [];
      let inserted: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
        insert: (value: Record<string, unknown>) => { inserted = value; return query; },
        single: async () => {
          if (table !== "cars" || !inserted) throw new Error("Unexpected insert");
          fixture.inserts++;
          const row = { ...inserted, id: "92000000-0000-4000-8000-000000000001" };
          fixture.rows.push(row);
          return { data: row, error: null };
        },
        maybeSingle: async () => ({ data: fixture.rows.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }),
      };
      return query;
    },
  }),
}));
import { saveCar } from "./actions";

function newCar() {
  const form = new FormData();
  Object.entries({ carMode: "manual", carMake: "Volkswagen", carModel: "Golf", fuelType: "petrol", consumptionL100Km: "6", carSeatsTotal: "4", plateLast3: "abc", owner_id: "someone-else" }).forEach(([key, value]) => form.set(key, value));
  return form;
}
beforeEach(() => { fixture.userId = "driver"; fixture.rows = []; fixture.inserts = 0; });

describe("saveCar", () => {
  it("persists independently of a ride, assigns the signed-in owner, and reuses the saved record", async () => {
    const result = await saveCar(newCar());
    expect(result.ok).toBe(true);
    expect(fixture.rows[0]).toMatchObject({ owner_id: "driver", make: "Volkswagen", plate_last3: "ABC" });
    const selection = new FormData();
    selection.set("carMode", "existing");
    selection.set("carId", String(fixture.rows[0].id));
    expect(await saveCar(selection)).toMatchObject({ ok: true, car: { id: fixture.rows[0].id } });
    expect(fixture.inserts).toBe(1);
  });

  it("rejects unauthenticated saves", async () => {
    fixture.userId = null;
    expect(await saveCar(newCar())).toMatchObject({ ok: false });
    expect(fixture.inserts).toBe(0);
  });

  it("rejects invalid car details before writing", async () => {
    const form = newCar();
    form.set("carSeatsTotal", "99");
    expect(await saveCar(form)).toMatchObject({ ok: false });
    expect(fixture.inserts).toBe(0);
  });

  it("cannot select another driver's car", async () => {
    await saveCar(newCar());
    fixture.userId = "another-driver";
    const form = new FormData();
    form.set("carMode", "existing");
    form.set("carId", String(fixture.rows[0].id));
    expect(await saveCar(form)).toMatchObject({ ok: false });
    expect(fixture.inserts).toBe(1);
  });
});
