import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 셀프호스팅(Docker)용 최소 번들 출력. Vercel 배포에는 영향 없음.
  output: "standalone",
};

export default nextConfig;
