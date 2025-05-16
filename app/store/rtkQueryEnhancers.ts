// app/store/rtkQueryEnhancers.ts - Perbaikan untuk setupListeners
// Enhancers and configurations for RTK Query to work with Suspense

import { createApi } from "@reduxjs/toolkit/query/react";
import { setupListeners } from "@reduxjs/toolkit/query";
import { store } from "./index";

// Function to enable RTK Query for Suspense
export function configureSuspenseForRTKQuery() {
  // Setup listeners for refresh behavior - perbaikan tipe parameter
  setupListeners(store.dispatch);

  console.log("[RTK Query] Suspense support configured");
}

// Helper to enhance existing endpoints with Suspense support
export function enhanceEndpointWithSuspense(options: any = {}) {
  // Default options for Suspense-compatible queries
  const suspenseOptions = {
    skip: false, // Don't skip the query
    refetchOnMountOrArgChange: false, // Don't refetch if data exists
    refetchOnFocus: false, // Don't refetch when window gains focus
    refetchOnReconnect: true, // Do refetch when reconnected
    ...options,
  };

  return suspenseOptions;
}

// Custom hook factory to create Suspense-ready hooks
export function createSuspenseHook(useQueryHook: any) {
  return function useSuspenseQuery(...args: any[]) {
    // Get the original args and options
    const queryArg = args[0];
    const options = args[1] || {};

    // Enhance with Suspense options
    const enhancedOptions = enhanceEndpointWithSuspense(options);

    // Call the original hook with enhanced options
    return useQueryHook(queryArg, enhancedOptions);
  };
}

// Use this in your component setup
export function setupSuspenseHooks(api: ReturnType<typeof createApi>) {
  // Create Suspense-ready hooks for each query
  return Object.keys(api.endpoints)
    .filter((endpoint) => "useQuery" in (api.endpoints as any)[endpoint])
    .reduce((acc, endpoint) => {
      const hookName = `use${
        endpoint.charAt(0).toUpperCase() + endpoint.slice(1)
      }SuspenseQuery`;
      acc[hookName] = createSuspenseHook(
        (api.endpoints as any)[endpoint].useQuery
      );
      return acc;
    }, {} as Record<string, any>);
}

// Helper untuk inisialisasi Suspense config sekaligus pada awal aplikasi
export function initializeSuspenseForRTKQuery() {
  // Konfigurasi untuk mendukung Suspense
  configureSuspenseForRTKQuery();

  // Return hooks tambahan atau utility jika diperlukan
  return {
    enhanceEndpointWithSuspense,
  };
}
