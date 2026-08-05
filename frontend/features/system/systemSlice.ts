import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { BackendHealth } from "@/types/backend";
import { fetchBackendHealth } from "./backendClient";

export type BackendStatus = "idle" | "checking" | "connected" | "error";

export interface BackendState {
  status: BackendStatus;
  address: string;
  version: string | null;
  checkedAt: number | null;
  error: string | null;
}

export interface SystemState {
  appName: string;
  appVersion: string;
  backend: BackendState;
}

export const checkBackendHealth = createAsyncThunk<
  BackendHealth,
  void,
  { rejectValue: string }
>("system/checkBackendHealth", async (_, { rejectWithValue }) => {
  try {
    return await fetchBackendHealth();
  } catch (error) {
    return rejectWithValue(
      error instanceof Error ? error.message : "Unknown backend error",
    );
  }
});

const initialState: SystemState = {
  appName: "GuideForge",
  appVersion: "0.1.0",
  backend: {
    status: "idle",
    address: "http://127.0.0.1:3939",
    version: null,
    checkedAt: null,
    error: null,
  },
};

const systemSlice = createSlice({
  name: "system",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkBackendHealth.pending, (state) => {
        state.backend.status = "checking";
        state.backend.error = null;
      })
      .addCase(checkBackendHealth.fulfilled, (state, action) => {
        state.backend.status = "connected";
        state.backend.version = action.payload.version;
        state.backend.checkedAt = Date.now();
        state.backend.error = null;
      })
      .addCase(checkBackendHealth.rejected, (state, action) => {
        state.backend.status = "error";
        state.backend.checkedAt = Date.now();
        state.backend.error = action.payload ?? "Backend unreachable";
      });
  },
});

export default systemSlice.reducer;
