type RoomLike = {
  amenities?: string | null;
  maxGuests?: number | null;
  name: string;
};

export type RoomWingId = "ala-principal" | "ala-anexo";

export type RoomWingSummary = {
  description: string;
  highlights: string[];
  id: RoomWingId;
  title: string;
};

export function getRoomAmenitiesList(amenities?: string | null) {
  return String(amenities || "")
    .split(",")
    .map((amenity) => amenity.trim())
    .filter(Boolean);
}

/**
 * Ordem fixa das acomodações em todo o site: Térreo, Superior, Chalé, Anexo.
 * Nomes que não forem reconhecidos vão para o fim, mantendo a ordem original entre eles.
 */
export function roomDisplayRank(name: string) {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("terreo")) return 0;
  if (normalized.includes("superior")) return 1;
  if (normalized.includes("chale")) return 2;
  if (normalized.includes("anexo")) return 3;
  return 9;
}

export function sortRoomsForDisplay<T extends { name: string }>(rooms: readonly T[]): T[] {
  return [...rooms].sort((left, right) => roomDisplayRank(left.name) - roomDisplayRank(right.name));
}

export function isMainWingRoom(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("superior") || normalized.includes("terreo") || normalized.includes("térreo");
}

export function isAnnexWingRoom(name: string) {
  const normalized = name.toLowerCase();
  return normalized.includes("chale") || normalized.includes("chalé") || normalized.includes("anexo");
}

export function buildWingSummaries(rooms: RoomLike[]): RoomWingSummary[] {
  const mainWingRooms = rooms.filter((room) => isMainWingRoom(room.name));
  const annexWingRooms = rooms.filter((room) => isAnnexWingRoom(room.name));

  const mainWingMaxGuests = Math.max(...mainWingRooms.map((room) => Number(room.maxGuests || 0)), 0);
  const annexWingMaxGuests = Math.max(...annexWingRooms.map((room) => Number(room.maxGuests || 0)), 0);

  return [
    {
      id: "ala-principal",
      title: "Ala Principal",
      description: "Apartamentos localizados na ala principal da pousada.",
      highlights: [
        "Apartamentos térreo e superior",
        mainWingMaxGuests > 0 ? `Até ${mainWingMaxGuests} hóspedes` : "Consulte capacidade",
      ],
    },
    {
      id: "ala-anexo",
      title: "Ala Chalés e Anexos",
      description: "Chalés e apartamentos localizados na ala de anexos.",
      highlights: [
        "Chalés e apartamentos anexos",
        annexWingMaxGuests > 0 ? `Até ${annexWingMaxGuests} hóspedes` : "Consulte capacidade",
      ],
    },
  ];
}
