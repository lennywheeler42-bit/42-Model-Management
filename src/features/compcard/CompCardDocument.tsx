import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FRONT_LOGO_WIDTH, LOGO_HEIGHT, MARGIN, NAME_TRACKING, PAGE, nameSize, type Layout, type Theme } from "./layout";

// Names are never broken with a hyphen; nameSize keeps them on one line instead.
Font.registerHyphenationCallback((word) => [word]);

// Two-sided comp card (5.5 × 8.5 in): front = the front layout's photos, the name and
// the 42 logo; back = the back layout's photos, approved measurements, the logo and
// agency contact details only. Frames come from layout.ts, as in the editor.
export type CompCardData = {
  name: string;
  location: string | null;
  theme: Theme;
  front: Layout;
  back: Layout;
  // Already framed to each slot's shape, keyed by slot id. Empty slots are left blank.
  images: Record<string, Buffer>;
  stats: { label: string; value: string }[];
  contact: { email: string; phone: string | null; website: string | null; locationLine: string | null };
  logo: { data: Buffer; width: number; height: number } | null;
};

const ACCENT = "#9e1923";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", position: "relative" },
  name: { fontFamily: "Helvetica-Bold", letterSpacing: NAME_TRACKING, textTransform: "uppercase" },
  meta: { fontSize: 7, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 3 },
  brand: { fontSize: 6, letterSpacing: 2.2, textTransform: "uppercase", fontFamily: "Helvetica-Bold", marginTop: 2, textAlign: "center" },
  mark: { fontSize: 18, fontFamily: "Helvetica-Bold", color: ACCENT },
  stats: { position: "absolute", left: MARGIN, right: MARGIN, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, borderTopWidth: 0.6, paddingTop: 8 },
  statLabel: { fontSize: 6, letterSpacing: 1.2, textTransform: "uppercase" },
  statValue: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 1 },
  footer: { position: "absolute", left: MARGIN, right: MARGIN, bottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  contact: { fontSize: 7, textAlign: "right", lineHeight: 1.5 },
});

// The 42 / FORTY TWO mark, with "Model Management" set in type under it.
function Logo({ card }: { card: CompCardData }) {
  const { logo, theme } = card;
  return <View style={{ alignItems: "center" }}>
    {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
    {logo ? <Image src={logo.data} style={{ height: LOGO_HEIGHT, width: (LOGO_HEIGHT * logo.width) / logo.height }} /> : <Text style={styles.mark}>42</Text>}
    <Text style={[styles.brand, { color: theme.ink }]}>Model Management</Text>
  </View>;
}

function Photos({ layout, card }: { layout: Layout; card: CompCardData }) {
  return <>{layout.slots.map((slot) => card.images[slot.id]
    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute
    ? <Image key={slot.id} src={card.images[slot.id]} style={{ position: "absolute", left: slot.x, top: slot.y, width: slot.width, height: slot.height, objectFit: "cover" }} />
    : null)}</>;
}

export function CompCardDocument({ card }: { card: CompCardData }) {
  const size: [number, number] = [PAGE.width, PAGE.height];
  const { theme } = card;
  const photoBottom = Math.max(...card.front.slots.map((slot) => slot.y + slot.height));
  const backBottom = Math.max(...card.back.slots.map((slot) => slot.y + slot.height));
  const nameWidth = PAGE.width - MARGIN * 2 - FRONT_LOGO_WIDTH - 12;
  const page = [styles.page, { backgroundColor: theme.paper, color: theme.ink }];
  return <Document title={`${card.name} — 42 Model Management comp card`} author="42 Model Management" creator="42 Model Management">
    <Page size={size} style={page}>
      <Photos layout={card.front} card={card} />
      {/* Name and logo each have a fixed box: in a flex row react-pdf narrows the
          name's box and wraps names that nameSize sized for one line. */}
      <View style={{ position: "absolute", left: MARGIN, width: nameWidth, top: photoBottom + 10, bottom: 14, justifyContent: "center" }}>
        <Text style={[styles.name, { fontSize: nameSize(card.name, nameWidth) }]}>{card.name}</Text>
        {card.location ? <Text style={[styles.meta, { color: theme.muted }]}>{card.location}</Text> : null}
      </View>
      <View style={{ position: "absolute", right: MARGIN, width: FRONT_LOGO_WIDTH, top: photoBottom + 10, bottom: 14, justifyContent: "center", alignItems: "flex-end" }}>
        <Logo card={card} />
      </View>
    </Page>
    <Page size={size} style={page}>
      <Photos layout={card.back} card={card} />
      {card.stats.length > 0 && <View style={[styles.stats, { top: backBottom + 12, borderTopColor: theme.rule }]}>{card.stats.map((stat) => <View key={stat.label}>
        <Text style={[styles.statLabel, { color: theme.muted }]}>{stat.label}</Text><Text style={styles.statValue}>{stat.value}</Text>
      </View>)}</View>}
      <View style={styles.footer}>
        <Logo card={card} />
        <View>
          <Text style={styles.contact}>{card.contact.email}</Text>
          {card.contact.phone ? <Text style={styles.contact}>{card.contact.phone}</Text> : null}
          {card.contact.website ? <Text style={styles.contact}>{card.contact.website}</Text> : null}
          {card.contact.locationLine ? <Text style={styles.contact}>{card.contact.locationLine}</Text> : null}
        </View>
      </View>
    </Page>
  </Document>;
}
