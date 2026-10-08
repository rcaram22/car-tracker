import { useEffect, useState } from 'react';

export function useObjectUrl(data?: ArrayBuffer, type?: string) {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!data) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([data], { type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [data, type]);

  return url;
}
