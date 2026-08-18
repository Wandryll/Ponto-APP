import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

export function WebcamCapture({ value, onChange }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      console.error(e);
    }
  };

  useEffect(() => () => stop(), []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
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
          <Button type="button" onClick={start} className="gap-2">
            <Camera className="h-4 w-4" /> Abrir câmera
          </Button>
        )}
        {!value && active && (
          <Button type="button" onClick={capture} className="gap-2">
            <Camera className="h-4 w-4" /> Tirar foto
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
