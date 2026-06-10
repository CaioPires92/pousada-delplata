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
      description: "Praticidade e ótimo custo-benefício. Perfeito para famílias e casais.",
      highlights: [
        "Apartamentos térreo e superior",
        mainWingMaxGuests > 0 ? `Até ${mainWingMaxGuests} hóspedes` : "Consulte capacidade",
      ],
    },
    {
      id: "ala-anexo",
      title: "Ala Chalés e Anexos",
      description: "Mais privacidade em meio à natureza. Espaço ideal para relaxar.",
      highlights: [
        "Chalés e apartamentos anexos",
        annexWingMaxGuests > 0 ? `Até ${annexWingMaxGuests} hóspedes` : "Consulte capacidade",
      ],
    },
  ];
}
