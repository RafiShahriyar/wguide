export interface BackendHealth {
  status: "ok";
  app: string;
  version: string;
}

export interface BackendVersion {
  version: string;
}
