import { useOutletContext } from 'react-router-dom';

interface LayoutContext {
  onMobileMenuToggle: () => void;
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}
