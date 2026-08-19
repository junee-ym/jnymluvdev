import ConnectionCheck from "@/components/connection-check";

export default function Home() {
  return <ConnectionCheck isVercel={!!process.env.VERCEL} />;
}
