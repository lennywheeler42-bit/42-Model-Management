export type TalentStatus = "published" | "review" | "draft" | "archived";

export type Talent = {
  id: string;
  talentId?: string;
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  location: string;
  board: string;
  boardSlug: string;
  gender: string;
  age: number;
  height: string;
  stats: { label: string; value: string }[];
  image: string;
  gallery: string[];
  tags: string[];
  status: TalentStatus;
  featured?: boolean;
  showOnWebsite: boolean;
  bio: string;
};

const image = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

export const talents: Talent[] = [
  {
    id: "T-1042",
    slug: "saih-williams",
    name: "Saih Williams",
    firstName: "Saih",
    lastName: "Williams",
    location: "Dallas",
    board: "Men / Development",
    boardSlug: "men-development",
    gender: "Male",
    age: 20,
    height: "6' 1\"",
    stats: [
      { label: "Height", value: "6' 1\" / 185 cm" },
      { label: "Chest", value: "38\" / 97 cm" },
      { label: "Waist", value: "30\" / 76 cm" },
      { label: "Shoe", value: "11 US" },
      { label: "Eyes", value: "Brown" },
      { label: "Hair", value: "Black" },
    ],
    image: image("photo-1539571696357-5a69c17a67c6"),
    gallery: [
      image("photo-1539571696357-5a69c17a67c6"),
      image("photo-1617127365659-c47fa864d8bc"),
      image("photo-1500648767791-00dcc994a43e"),
    ],
    tags: ["Editorial", "Commercial", "Runway"],
    status: "published",
    featured: true,
    showOnWebsite: true,
    bio: "Saih brings a natural, athletic ease to every frame. Dallas-based and available for editorial, commercial, and runway bookings.",
  },
  {
    id: "T-1038",
    slug: "amara-jones",
    name: "Amara Jones",
    firstName: "Amara",
    lastName: "Jones",
    location: "Atlanta",
    board: "Women / Mainboard",
    boardSlug: "women-mainboard",
    gender: "Female",
    age: 24,
    height: "5' 10\"",
    stats: [
      { label: "Height", value: "5' 10\" / 178 cm" },
      { label: "Bust", value: "32\" / 81 cm" },
      { label: "Waist", value: "24\" / 61 cm" },
      { label: "Hips", value: "35\" / 89 cm" },
      { label: "Eyes", value: "Brown" },
      { label: "Hair", value: "Dark Brown" },
    ],
    image: image("photo-1534528741775-53994a69daeb"),
    gallery: [
      image("photo-1534528741775-53994a69daeb"),
      image("photo-1524504388940-b1c1722653e1"),
      image("photo-1488426862026-3ee34a7d66df"),
    ],
    tags: ["Beauty", "Fashion", "Lifestyle"],
    status: "published",
    featured: true,
    showOnWebsite: true,
    bio: "Amara is an Atlanta-based fashion and beauty talent with a precise, expressive point of view.",
  },
  {
    id: "T-1027",
    slug: "noah-cole",
    name: "Noah Cole",
    firstName: "Noah",
    lastName: "Cole",
    location: "New York",
    board: "Men / Mainboard",
    boardSlug: "men-mainboard",
    gender: "Male",
    age: 27,
    height: "6' 2\"",
    stats: [
      { label: "Height", value: "6' 2\" / 188 cm" },
      { label: "Chest", value: "40\" / 102 cm" },
      { label: "Waist", value: "31\" / 79 cm" },
      { label: "Shoe", value: "12 US" },
      { label: "Eyes", value: "Green" },
      { label: "Hair", value: "Brown" },
    ],
    image: image("photo-1506794778202-cad84cf45f1d"),
    gallery: [
      image("photo-1506794778202-cad84cf45f1d"),
      image("photo-1507003211169-0a1dd7228f2d"),
      image("photo-1519085360753-af0119f7cbe7"),
    ],
    tags: ["Commercial", "Lifestyle", "Fitness"],
    status: "published",
    showOnWebsite: true,
    bio: "Noah works across fashion, fitness, and lifestyle with a calm, modern presence.",
  },
  {
    id: "T-1016",
    slug: "maya-parker",
    name: "Maya Parker",
    firstName: "Maya",
    lastName: "Parker",
    location: "Los Angeles",
    board: "Women / Development",
    boardSlug: "women-development",
    gender: "Female",
    age: 21,
    height: "5' 9\"",
    stats: [
      { label: "Height", value: "5' 9\" / 175 cm" },
      { label: "Bust", value: "33\" / 84 cm" },
      { label: "Waist", value: "25\" / 64 cm" },
      { label: "Hips", value: "36\" / 91 cm" },
      { label: "Eyes", value: "Hazel" },
      { label: "Hair", value: "Light Brown" },
    ],
    image: image("photo-1524250502761-1ac6f2e30d43"),
    gallery: [
      image("photo-1524250502761-1ac6f2e30d43"),
      image("photo-1496747611176-843222e1e57c"),
      image("photo-1512316609839-ce289d3eba0a"),
    ],
    tags: ["Editorial", "Beauty", "Commercial"],
    status: "published",
    showOnWebsite: true,
    bio: "Maya is a Los Angeles-based development talent with an instinct for clean, considered imagery.",
  },
  {
    id: "T-1008",
    slug: "lena-martin",
    name: "Lena Martin",
    firstName: "Lena",
    lastName: "Martin",
    location: "Chicago",
    board: "Women / Curve",
    boardSlug: "women-curve",
    gender: "Female",
    age: 29,
    height: "5' 8\"",
    stats: [
      { label: "Height", value: "5' 8\" / 173 cm" },
      { label: "Bust", value: "39\" / 99 cm" },
      { label: "Waist", value: "32\" / 81 cm" },
      { label: "Hips", value: "45\" / 114 cm" },
      { label: "Eyes", value: "Brown" },
      { label: "Hair", value: "Black" },
    ],
    image: image("photo-1551836022-d5d88e9218df"),
    gallery: [
      image("photo-1551836022-d5d88e9218df"),
      image("photo-1531123897727-8f129e1688ce"),
      image("photo-1517841905240-472988babdf9"),
    ],
    tags: ["Commercial", "Lifestyle", "Beauty"],
    status: "published",
    showOnWebsite: true,
    bio: "Lena is a Chicago-based curve talent known for warmth, clarity, and a strong commercial read.",
  },
  {
    id: "T-0997",
    slug: "eli-rivera",
    name: "Eli Rivera",
    firstName: "Eli",
    lastName: "Rivera",
    location: "Miami",
    board: "Men / Commercial",
    boardSlug: "men-commercial",
    gender: "Male",
    age: 23,
    height: "6' 0\"",
    stats: [
      { label: "Height", value: "6' 0\" / 183 cm" },
      { label: "Chest", value: "39\" / 99 cm" },
      { label: "Waist", value: "31\" / 79 cm" },
      { label: "Shoe", value: "11 US" },
      { label: "Eyes", value: "Brown" },
      { label: "Hair", value: "Black" },
    ],
    image: image("photo-1501196354995-cbb51c65aaea"),
    gallery: [
      image("photo-1501196354995-cbb51c65aaea"),
      image("photo-1504593811423-6dd665756598"),
      image("photo-1507003211169-0a1dd7228f2d"),
    ],
    tags: ["Commercial", "Fitness", "Lifestyle"],
    status: "review",
    showOnWebsite: false,
    bio: "Eli is a Miami-based commercial talent currently in internal review.",
  },
];

export const boards = [
  { name: "Women / Mainboard", slug: "women-mainboard", count: 18, color: "rose" },
  { name: "Men / Mainboard", slug: "men-mainboard", count: 14, color: "blue" },
  { name: "Women / Development", slug: "women-development", count: 22, color: "sand" },
  { name: "Men / Development", slug: "men-development", count: 11, color: "sage" },
  { name: "Women / Curve", slug: "women-curve", count: 9, color: "lavender" },
  { name: "Men / Commercial", slug: "men-commercial", count: 16, color: "amber" },
];

export const publicTalents = talents.filter(
  (talent) => talent.status === "published" && talent.showOnWebsite,
);
