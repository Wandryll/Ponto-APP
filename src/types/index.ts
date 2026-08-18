export type Role = "admin" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: string;
  team: string;
  avatar: string;
  active: boolean;
  admissionDate: string;
}

export type CheckpointType = "checkin" | "checkout";

export interface CheckpointRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: CheckpointType;
  timestamp: string;
  latitude: number;
  longitude: number;
  address: string;
  photo: string;
  status: "on_time" | "late" | "early";
}
