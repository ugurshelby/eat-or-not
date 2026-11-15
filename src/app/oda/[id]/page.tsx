import RoomGame from "@/components/room/RoomGame";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomGame id={id} />;
}
