import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리집",
  description: "가족 일상 기록 및 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
