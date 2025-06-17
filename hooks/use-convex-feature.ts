import { useState, useEffect } from 'react';

/**
 * Hook to check if Convex is enabled via feature flag
 * This allows for gradual migration and A/B testing
 */
export function useConvexFeature() {
  const [isConvexEnabled, setIsConvexEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check environment variable
    const convexEnabled = process.env.NEXT_PUBLIC_USE_CONVEX === 'true';
    setIsConvexEnabled(convexEnabled);
    setIsLoading(false);
  }, []);

  return {
    isConvexEnabled,
    isLoading,
    // Helper methods
    isLegacyMode: !isConvexEnabled,
    isConvexMode: isConvexEnabled,
  };
}

/**
 * Hook to get the appropriate chat service based on feature flag
 */
export function useChatService() {
  const { isConvexEnabled, isLoading } = useConvexFeature();

  return {
    isConvexEnabled,
    isLoading,
    // Service selection will be handled by the consuming components
    serviceType: isConvexEnabled ? 'convex' : 'legacy',
  };
}