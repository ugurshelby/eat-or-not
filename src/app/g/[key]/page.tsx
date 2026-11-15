import Welcome from "@/components/Welcome";

export default async function LinkPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <Welcome linkKey={key} />;
}
