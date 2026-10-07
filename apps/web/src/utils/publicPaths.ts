export const PUBLIC_PATHS = ['/login', '/pantalla', '/voucher', '/deslinde', '/~offline'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
