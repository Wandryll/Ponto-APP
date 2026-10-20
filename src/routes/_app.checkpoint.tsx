import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LogIn,
  LogOut,
  Loader2,
  MapPin,
  RefreshCw,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WebcamCapture } from "@/components/camera/webcam-capture";
import { LocationMap } from "@/components/maps/location-map";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { useRecords } from "@/contexts/records-context";
import { calculateWorkedMilliseconds } from "@/lib/attendance";

export const Route = createFileRoute("/_app/checkpoint")({
  head: () => ({ meta: [{ title: "Check-in / Check-out — Ponto DCT" }] }),
  component: CheckpointPage,
});

type CheckpointType = "CHECKIN" | "CHECKOUT";

interface Coords {
  lat: number;
  lng: number;
  address: string;
  accuracy: number;
  capturedAt: number;
}

interface WorkLocation {
  nome: string;
  latitude: number;
  longitude: number;
  raio_metros: number;
}

const STORAGE_BUCKET = "fotos_ponto";
const REGISTROS_TABLE = "registros_acesso";
const LOCATION_MAX_AGE_MS = 2 * 60 * 1000;
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024;

function dataUrlToBlob(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");
  if (separatorIndex === -1) throw new Error("A foto capturada está em um formato inválido.");

  const metadata = dataUrl.slice(0, separatorIndex);
  const encodedData = dataUrl.slice(separatorIndex + 1);
  const mimeType = metadata.match(/^data:([^;]+);base64$/)?.[1];
  if (!mimeType || mimeType !== "image/jpeg") {
    throw new Error("A foto capturada não está no formato JPEG esperado.");
  }

  const binary = window.atob(encodedData);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError && /fetch|network|load/i.test(error.message);
}

function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const latDelta = toRadians(lat2 - lat1);
  const lngDelta = toRadians(lng2 - lng1);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDelta / 2) ** 2;

  const normalized = Math.min(1, Math.max(0, a));

  return earthRadius * 2 * Math.atan2(Math.sqrt(normalized), Math.sqrt(1 - normalized));
}

function CheckpointPage() {
  const { user } = useAuth();
  const { records, refresh } = useRecords();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocation | null>(null);
  const [locating, setLocating] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);
  const [geofenceError, setGeofenceError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<CheckpointType | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const requestLocation = () => {
    setLocating(true);
    setLocError(null);
    setCoords(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("Geolocalização não suportada.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const fallbackAddress = `Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`;

        setCoords({
          lat: latitude,
          lng: longitude,
          address: fallbackAddress,
          accuracy,
          capturedAt: Date.now(),
        });
        setLocating(false);

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "Accept-Language": "pt-BR" } },
          );
          if (!response.ok) return;

          const data = (await response.json()) as { display_name?: string };
          const displayName = data.display_name;
          if (displayName) {
            setCoords((current) =>
              current?.lat === latitude && current.lng === longitude
                ? { ...current, address: displayName }
                : current,
            );
          }
        } catch (error) {
          console.warn("Falha ao obter endereço do usuário:", error);
        }
      },
      (error) => {
        console.warn("Falha na geolocalização:", error);
        setLocError("Permita o acesso à localização para registrar o ponto.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    requestLocation();

    const fetchWorkLocation = async () => {
      const { data, error } = await supabase
        .from("locais_trabalho")
        .select("nome,latitude,longitude,raio_metros")
        .eq("ativo", true)
        .maybeSingle();

      if (error || !data) {
        setGeofenceError("A área autorizada ainda não está disponível.");
        return;
      }

      setWorkLocation(data as WorkLocation);
      setGeofenceError(null);
    };

    void fetchWorkLocation();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!user) return null;

  const today = new Date().toDateString();
  const latestToday = records
    .filter(
      (record) => record.userId === user.id && new Date(record.timestamp).toDateString() === today,
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const userRecords = records
    .filter((record) => record.userId === user.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const todayUserRecords = userRecords.filter(
    (record) => new Date(record.timestamp).toDateString() === today,
  );
  const workedTodayMs = calculateWorkedMilliseconds(todayUserRecords);
  const workedTodayHours = Math.floor(workedTodayMs / 3_600_000);
  const workedTodayMinutes = Math.floor((workedTodayMs % 3_600_000) / 60_000);
  const canCheckin = !latestToday || latestToday.type === "checkout";
  const canCheckout = latestToday?.type === "checkin";
  const distance =
    coords && workLocation
      ? distanceInMeters(coords.lat, coords.lng, workLocation.latitude, workLocation.longitude)
      : null;
  const isInsideGeofence =
    distance !== null && workLocation !== null && distance <= workLocation.raio_metros;
  const isLocationFresh = Boolean(coords && currentTime - coords.capturedAt <= LOCATION_MAX_AGE_MS);
  const locationReady = Boolean(
    coords && workLocation && isInsideGeofence && isLocationFresh && !locating,
  );

  const handleSubmit = async (type: CheckpointType) => {
    if ((type === "CHECKIN" && !canCheckin) || (type === "CHECKOUT" && !canCheckout)) {
      toast.error("A sequência de registros não permite esta operação.");
      return;
    }
    if (!photo) {
      toast.error("Capture uma foto antes de registrar.");
      return;
    }

    if (!coords) {
      toast.error("Aguarde a localização ser obtida.");
      return;
    }

    if (!isLocationFresh) {
      toast.error("Atualize sua localização antes de registrar o ponto.");
      return;
    }

    if (!workLocation || !isInsideGeofence) {
      toast.error("Você precisa estar dentro da área autorizada do DCT.");
      return;
    }

    setSubmitting(type);

    try {
      const blob = dataUrlToBlob(photo);
      if (blob.size > MAX_PHOTO_SIZE_BYTES) {
        throw new Error("A foto ficou muito grande. Tire outra foto e tente novamente.");
      }

      const safeUserId = encodeURIComponent(user.id);
      const fileName = `${safeUserId}/${Date.now()}.jpg`;

      let uploadError: { message: string } | null;
      try {
        ({ error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, blob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          }));
      } catch (error) {
        if (isNetworkError(error)) {
          throw new Error(
            "Não foi possível conectar ao armazenamento. Verifique sua internet e tente novamente.",
          );
        }
        throw error;
      }

      if (uploadError) {
        throw new Error(`Erro ao salvar foto: ${uploadError.message}`);
      }

      let insertError: { message: string } | null;
      try {
        ({ error: insertError } = await supabase.from(REGISTROS_TABLE).insert({
          colaborador_id: user.id,
          tipo: type,
          latitude: coords.lat,
          longitude: coords.lng,
          foto_path: fileName,
        }));
      } catch (error) {
        await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
        if (isNetworkError(error)) {
          throw new Error(
            "A foto foi enviada, mas não foi possível conectar ao registro de ponto. Tente novamente.",
          );
        }
        throw error;
      }

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
        const message = insertError.message.includes("fora da área permitida")
          ? "Você está fora da área autorizada do DCT."
          : `Erro ao registrar ponto: ${insertError.message}`;
        throw new Error(message);
      }

      toast.success(`${type === "CHECKIN" ? "Check-in" : "Check-out"} registrado com sucesso!`);
      setPhoto(null);
      await refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado ao registrar o ponto.";
      console.error(error);
      toast.error(message);
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Registro de ponto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Capture sua foto e confirme sua localização para registrar.
        </p>
      </div>

      <Card
        className={latestToday ? "border-success/30 bg-success/5" : "border-border bg-muted/20"}
      >
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <CheckCircle2
            className={`mt-0.5 h-5 w-5 shrink-0 ${latestToday ? "text-success" : "text-muted-foreground"}`}
          />
          <div>
            <p className="font-semibold text-sm">
              {latestToday ? "Última ação registrada" : "Nenhum registro realizado hoje"}
            </p>
            {latestToday && (
              <p className="mt-1 text-sm text-muted-foreground">
                {latestToday.type === "checkin" ? "Entrada" : "Saída"} registrada às{" "}
                {new Date(latestToday.timestamp).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . Próxima ação: {latestToday.type === "checkin" ? "check-out" : "check-in"}.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> Localização
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={requestLocation}
                disabled={locating}
                aria-label="Atualizar localização"
              >
                <RefreshCw className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locating ? (
              <div className="h-[260px] rounded-xl bg-muted animate-pulse grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : coords ? (
              <>
                <LocationMap lat={coords.lat} lng={coords.lng} label={coords.address} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="text-xs text-muted-foreground">Latitude</div>
                    <div className="font-medium tabular-nums">{coords.lat.toFixed(6)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="text-xs text-muted-foreground">Longitude</div>
                    <div className="font-medium tabular-nums">{coords.lng.toFixed(6)}</div>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/60 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Endereço</div>
                  <div className="font-medium">{coords.address}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="text-xs text-muted-foreground">Precisão estimada</div>
                    <div className="font-medium">± {Math.round(coords.accuracy)} m</div>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <div className="text-xs text-muted-foreground">Distância do DCT</div>
                    <div className="font-medium">
                      {distance === null ? "—" : `${Math.round(distance)} m`}
                    </div>
                  </div>
                </div>
                {workLocation && distance !== null && (
                  <div
                    className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                      isInsideGeofence
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {isInsideGeofence ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {isInsideGeofence
                        ? `Dentro da área autorizada de ${workLocation.raio_metros} m.`
                        : `Fora da área autorizada de ${workLocation.raio_metros} m.`}
                    </span>
                  </div>
                )}
                {!isLocationFresh && (
                  <p className="text-sm text-warning">
                    A localização expirou. Atualize-a antes de registrar o ponto.
                  </p>
                )}
                {geofenceError && <p className="text-sm text-destructive">{geofenceError}</p>}
              </>
            ) : (
              <p className="text-sm text-destructive">{locError}</p>
            )}
            {locError && coords && <p className="text-xs text-warning">{locError}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foto do registro</CardTitle>
          </CardHeader>
          <CardContent>
            <WebcamCapture value={photo} onChange={setPhoto} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row gap-3">
          <Button
            className="flex-1 h-12 text-base gap-2 bg-success hover:bg-success/90 text-success-foreground"
            disabled={submitting !== null || !canCheckin || !locationReady}
            onClick={() => handleSubmit("CHECKIN")}
          >
            {submitting === "CHECKIN" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            Registrar Check-in
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 text-base gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={submitting !== null || !canCheckout || !locationReady}
            onClick={() => handleSubmit("CHECKOUT")}
          >
            {submitting === "CHECKOUT" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5" />
            )}
            Registrar Check-out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Meus registros recentes
          </CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total concluído hoje</p>
            <p className="text-sm font-semibold tabular-nums">
              {workedTodayHours}h {workedTodayMinutes.toString().padStart(2, "0")}min
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {userRecords.length ? (
            <div className="divide-y divide-border">
              {userRecords.slice(0, 10).map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-3 min-w-0">
                    <Badge variant={record.type === "checkin" ? "default" : "secondary"}>
                      {record.type === "checkin" ? "Entrada" : "Saída"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium tabular-nums">
                        {new Date(record.timestamp).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{record.address}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {record.status === "late" ? "Registro com atraso" : "Registro confirmado"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Você ainda não possui registros de ponto.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
