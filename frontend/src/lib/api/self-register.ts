import axios from "axios";
import { API_URL } from "../api-client";

export function selfRegisterDriver(payload: {
  token: string;
  fullName: string;
  phone: string;
  carPlate: string;
  carBrand: string;
  photo: File;
}) {
  const form = new FormData();
  form.append("token", payload.token);
  form.append("fullName", payload.fullName);
  form.append("phone", payload.phone);
  form.append("carPlate", payload.carPlate);
  form.append("carBrand", payload.carBrand);
  form.append("photo", payload.photo);
  return axios
    .post<{ ok: true; fullName: string }>(
      `${API_URL}/public/drivers/self-register`,
      form,
      { timeout: 45_000 },
    )
    .then((r) => r.data);
}
