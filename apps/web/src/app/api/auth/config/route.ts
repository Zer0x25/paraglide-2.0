import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const googleClientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '';
  return NextResponse.json({ googleClientId });
}
