import React from 'react';
import { Link as RouterLink, useInRouterContext } from 'react-router-dom';

export interface NextLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | { pathname?: string; query?: Record<string, string | number> };
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  children?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, NextLinkProps>(function Link(
  { href, replace, scroll: _scroll, prefetch: _prefetch, children, onClick, ...props },
  ref,
) {
  let to = '';
  if (typeof href === 'string') {
    to = href;
  } else if (href && typeof href === 'object') {
    to = href.pathname || '';
    if (href.query) {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(href.query)) {
        if (v !== undefined) sp.set(k, String(v));
      }
      const qs = sp.toString();
      if (qs) to += `?${qs}`;
    }
  }

  // Si no está en un Router (p.ej. tests unitarios de componentes aislados),
  // renderizamos un <a> nativo estándar para no romper la suite con Missing Router Context.
  let inRouter = false;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    inRouter = useInRouterContext();
  } catch {
    inRouter = false;
  }

  if (!inRouter) {
    return (
      <a ref={ref} href={to} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={to} replace={replace} onClick={onClick} {...props}>
      {children}
    </RouterLink>
  );
});

export default Link;
