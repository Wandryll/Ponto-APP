import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function WebcamCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setReady(false);
    setStarting(false);
  };

  const start = async () => {
    if (starting || active) return;

    setError(null);
    setReady(false);
    setStarting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("A câmera não está disponível neste navegador ou conexão.");
      setStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setActive(true);
    } catch (e) {
      if (mountedRef.current) {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
      console.error(e);
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  const connectVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (!element || !streamRef.current) return;

    element.srcObject = streamRef.current;
    void element.play().catch((playError) => {
      setError("Não foi possível iniciar a visualização da câmera.");
      console.error(playError);
    });
  }, []);

  useEffect(
    () => () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  const capture = () => {
    const video = videoRef.current;
    if (!video || !ready || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Aguarde a câmera terminar de carregar.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Não foi possível processar a foto capturada.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onChange(dataUrl);
    stop();
  };

  const retake = () => {
    onChange(null);
    start();
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted border border-border">
        {value ? (
          <img src={value} alt="Foto capturada" className="h-full w-full object-cover" />
        ) : active ? (
          <video
            ref={connectVideo}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
            onCanPlay={() => setReady(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Camera className="h-10 w-10" />
            <p className="text-sm">Câmera desativada</p>
          </div>
        )}
        {value && (
          <div className="absolute top-3 right-3 bg-success text-success-foreground text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Foto capturada
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {!value && !active && (
          <Button type="button" onClick={start} className="gap-2" disabled={starting}>
            <Camera className="h-4 w-4" /> {starting ? "Abrindo câmera..." : "Abrir câmera"}
          </Button>
        )}
        {!value && active && (
          <Button type="button" onClick={capture} className="gap-2" disabled={!ready}>
            <Camera className="h-4 w-4" /> {ready ? "Tirar foto" : "Iniciando câmera..."}
          </Button>
        )}
        {value && (
          <Button type="button" variant="outline" onClick={retake} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Refazer foto
          </Button>
        )}
      </div>
    </div>
  );
}
