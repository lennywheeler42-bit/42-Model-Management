import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Two-sided comp card (5.5 × 8.5 in): front = primary photo and name; back = up to
// four supporting photos, approved measurements and agency contact details only.
export type CompCardData = {
  name: string;
  location: string | null;
  primary: Buffer;
  supporting: Buffer[];
  stats: { label: string; value: string }[];
  contact: { email: string; phone: string | null; website: string | null; locationLine: string | null };
  logo: Buffer | null;
};

const INK = "#181817";
const MUTED = "#7a7770";
const ACCENT = "#9e1923";

const styles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", color: INK, fontFamily: "Helvetica", padding: 18 },
  frontImage: { width: "100%", height: 520, objectFit: "cover" },
  nameRow: { marginTop: 12 },
  name: { fontSize: 26, fontFamily: "Helvetica-Bold", letterSpacing: -0.5, textTransform: "uppercase" },
  metaRow: { marginTop: 2, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  meta: { fontSize: 7, color: MUTED, letterSpacing: 1.4, textTransform: "uppercase" },
  brand: { fontSize: 7, letterSpacing: 1.6, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  // Short enough that two rows of stats clear the logo in the footer.
  gridImage: { width: 177, height: 222, objectFit: "cover" },
  gridImageWide: { width: "100%", height: 450, objectFit: "cover" },
  stats: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, borderTopWidth: 0.6, borderTopColor: "#dcdcd6", paddingTop: 8 },
  statLabel: { fontSize: 6, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase" },
  statValue: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 1 },
  footer: { position: "absolute", left: 18, right: 18, bottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  mark: { fontSize: 13, fontFamily: "Helvetica-Bold", color: ACCENT },
  logo: { width: 72, height: 32, marginBottom: 3, objectFit: "contain" },
  contact: { fontSize: 7, color: INK, textAlign: "right", lineHeight: 1.5 },
});

const nameSize = (name: string) => (name.length > 28 ? 15 : name.length > 22 ? 20 : 26);

export function CompCardDocument({ card }: { card: CompCardData }) {
  const size: [number, number] = [396, 612];
  return <Document title={`${card.name} — 42 Model Management comp card`} author="42 Model Management" creator="42 Model Management">
    <Page size={size} style={styles.page}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
      <Image src={card.primary} style={styles.frontImage} />
      <View style={styles.nameRow}>
        {/* The name has the whole line, so a long one stays on the page and on one line. */}
        <Text style={[styles.name, { fontSize: nameSize(card.name) }]}>{card.name}</Text>
        <View style={styles.metaRow}><Text style={styles.meta}>{card.location ?? ""}</Text><Text style={styles.brand}>42 Model Management</Text></View>
      </View>
    </Page>
    <Page size={size} style={styles.page}>
      <View style={styles.grid}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
        {card.supporting.map((image, index) => <Image key={index} src={image} style={card.supporting.length === 1 ? styles.gridImageWide : styles.gridImage} />)}
      </View>
      {card.stats.length > 0 && <View style={styles.stats}>{card.stats.map((stat) => <View key={stat.label}><Text style={styles.statLabel}>{stat.label}</Text><Text style={styles.statValue}>{stat.value}</Text></View>)}</View>}
      <View style={styles.footer}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt attribute */}
        <View>{card.logo ? <Image src={card.logo} style={styles.logo} /> : <Text style={styles.mark}>42</Text>}<Text style={styles.brand}>Model Management</Text></View>
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
