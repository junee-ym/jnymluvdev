"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "checking" | "ok" | "error";

export default function ConnectionCheck({ isVercel }: { isVercel: boolean }) {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("Supabase에 연결하는 중...");

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setStatus("error");
          setDetail(error.message);
        } else {
          setStatus("ok");
          setDetail(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setDetail(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        연결 상태 확인
      </h1>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <StatusRow
          label="Vercel"
          ok={isVercel}
          detail={isVercel ? "이 페이지는 Vercel에서 서빙되고 있습니다" : "로컬 환경에서 실행 중"}
        />
        <StatusRow
          label="Supabase"
          ok={status === "ok"}
          pending={status === "checking"}
          detail={detail}
        />
      </div>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  pending,
  detail,
}: {
  label: string;
  ok: boolean;
  pending?: boolean;
  detail: string;
}) {
  const icon = pending ? "⏳" : ok ? "✅" : "❌";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-black/[.08] bg-white px-4 py-3 dark:border-white/[.145] dark:bg-zinc-900">
      <span className="text-xl leading-6">{icon}</span>
      <div className="flex flex-col">
        <span className="font-medium text-black dark:text-zinc-50">{label}</span>
        <span className="break-all text-sm text-zinc-500 dark:text-zinc-400">
          {detail}
        </span>
      </div>
    </div>
  );
}
