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
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebcamCapture } from "@/components/camera/webcam-capture";
import { LocationMap } from "@/components/maps/location-map";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { useRecords } from "@/contexts/records-context";

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
}

interface WorkLocation {
  nome: string;
  latitude: number;
  longitude: number;
  raio_metros: number;
}

const STORAGE_BUCKET = "fotos_ponto";
const REGISTROS_TABLE = "registros_acesso";

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

        setCoords({ lat: latitude, lng: longitude, address: fallbackAddress, accuracy });
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

  if (!user) return null;

  const today = new Date().toDateString();
  const latestToday = records
    .filter(
      (record) => record.userId === user.id && new Date(record.timestamp).toDateString() === today,
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  const canCheckin = !latestToday || latestToday.type === "checkout";
  const canCheckout = latestToday?.type === "checkin";
  const distance =
    coords && workLocation
      ? distanceInMeters(coords.lat, coords.lng, workLocation.latitude, workLocation.longitude)
      : null;
  const isInsideGeofence =
    distance !== null && workLocation !== null && distance <= workLocation.raio_metros;
  const locationReady = Boolean(coords && workLocation && isInsideGeofence && !locating);

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

    if (!workLocation || !isInsideGeofence) {
      toast.error("Você precisa estar dentro da área autorizada do DCT.");
      return;
    }

    setSubmitting(type);

    try {
      const response = await fetch(photo);
      if (!response.ok) {
        throw new Error("Não foi possível ler a foto capturada.");
      }

      const blob = await response.blob();
      const safeUserId = encodeURIComponent(user.id);
      const fileName = `${safeUserId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao salvar foto: ${uploadError.message}`);
      }

      const { error: insertError } = await supabase.from(REGISTROS_TABLE).insert({
        colaborador_id: user.id,
        tipo: type,
        latitude: coords.lat,
        longitude: coords.lng,
        foto_path: fileName,
      });

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
    </div>
  );
}
