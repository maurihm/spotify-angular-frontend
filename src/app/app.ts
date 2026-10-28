import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface SpotifyPayload {
  duration_ms: number;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  time_signature: number;
}

export interface PredictionRecord {
  timestamp: string;
  presetName: string;
  datasetTag: string;
  score: number;
  apiUrl: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  apiUrl = 'http://127.0.0.1:8000';
  datasetTag = '100% (i-love-adsoftsito-100)';
  modelSize: '25' | '50' | '100' = '100';
  activePreset = 'default';
  loading = false;
  errorMsg = '';
  copied = false;

  score: number | null = null;
  scoreSubtitle = 'Haz clic en "Calcular Popularidad" para consultar POST /score';

  history: PredictionRecord[] = [];

  payload: SpotifyPayload = {
    duration_ms: 230666,
    danceability: 0.676,
    energy: 0.461,
    key: 1,
    loudness: -6.746,
    mode: 0,
    speechiness: 0.143,
    acousticness: 0.0322,
    instrumentalness: 0.000001,
    liveness: 0.358,
    valence: 0.715,
    tempo: 87.917,
    time_signature: 4
  };

  presets: Record<string, { label: string; data: SpotifyPayload }> = {
    default: {
      label: 'Valores Originales (Payload Evaluación)',
      data: {
        duration_ms: 230666,
        danceability: 0.676,
        energy: 0.461,
        key: 1,
        loudness: -6.746,
        mode: 0,
        speechiness: 0.143,
        acousticness: 0.0322,
        instrumentalness: 0.000001,
        liveness: 0.358,
        valence: 0.715,
        tempo: 87.917,
        time_signature: 4
      }
    },
    hit: {
      label: 'Hit Pop / Urbano',
      data: {
        duration_ms: 195000,
        danceability: 0.85,
        energy: 0.82,
        key: 5,
        loudness: -4.5,
        mode: 1,
        speechiness: 0.08,
        acousticness: 0.04,
        instrumentalness: 0.0,
        liveness: 0.12,
        valence: 0.82,
        tempo: 122,
        time_signature: 4
      }
    },
    ballad: {
      label: 'Balada Acústica',
      data: {
        duration_ms: 220000,
        danceability: 0.38,
        energy: 0.25,
        key: 2,
        loudness: -13.5,
        mode: 0,
        speechiness: 0.03,
        acousticness: 0.88,
        instrumentalness: 0.005,
        liveness: 0.10,
        valence: 0.28,
        tempo: 74,
        time_signature: 4
      }
    },
    rock: {
      label: 'Rock Enérgico',
      data: {
        duration_ms: 245000,
        danceability: 0.52,
        energy: 0.89,
        key: 9,
        loudness: -5.1,
        mode: 1,
        speechiness: 0.06,
        acousticness: 0.02,
        instrumentalness: 0.08,
        liveness: 0.22,
        valence: 0.61,
        tempo: 134,
        time_signature: 4
      }
    },
    electronic: {
      label: 'Club / Electrónica',
      data: {
        duration_ms: 210000,
        danceability: 0.79,
        energy: 0.91,
        key: 7,
        loudness: -3.8,
        mode: 0,
        speechiness: 0.05,
        acousticness: 0.01,
        instrumentalness: 0.45,
        liveness: 0.15,
        valence: 0.74,
        tempo: 128,
        time_signature: 4
      }
    }
  };

  datasetLabels: Record<string, string> = {
    '25': '25% (i-love-adsoftsito-25)',
    '50': '50% (i-love-adsoftsito-50)',
    '100': '100% (i-love-adsoftsito-100)'
  };

  trainStatus: 'idle' | 'running' | 'done' | 'error' = 'idle';
  trainMessage = '';
  deployMessage = '';
  deployOk: boolean | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const savedUrl = localStorage.getItem('spotify_api_url');
    if (savedUrl) {
      this.apiUrl = savedUrl;
    }
  }

  onApiUrlChange(): void {
    localStorage.setItem('spotify_api_url', this.apiUrl.trim());
  }

  private get baseUrl(): string {
    return (this.apiUrl || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
  }

  retrain(): void {
    this.onApiUrlChange();
    this.trainStatus = 'running';
    this.trainMessage = `Entrenando con el dataset ${this.modelSize}%...`;
    this.http.post<any>(`${this.baseUrl}/train`, null, { params: { dataset: this.modelSize } }).subscribe({
      next: () => this.pollTrain(),
      error: (err) => {
        this.trainStatus = 'error';
        this.trainMessage = err?.error?.detail || 'No se pudo iniciar el reentrenamiento.';
      }
    });
  }

  publishImage(): void {
    this.onApiUrlChange();
    this.deployOk = null;
    this.deployMessage = 'Enviando a GitHub Actions...';
    this.http.post<{ tag: string; actions_url: string }>(`${this.baseUrl}/deploy`, null, { params: { dataset: this.modelSize } }).subscribe({
      next: (res) => {
        this.deployOk = true;
        this.deployMessage = `Workflow disparado. Se publicará la imagen ${res.tag}. Sigue el progreso en ${res.actions_url}`;
      },
      error: (err) => {
        this.deployOk = false;
        this.deployMessage = err?.error?.detail || 'No se pudo disparar el workflow.';
      }
    });
  }

  private pollTrain(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.http.get<any>(`${this.baseUrl}/train/status`).subscribe({
        next: (st) => {
          if (st.status === 'running') return;
          clearInterval(this.pollTimer!);
          this.pollTimer = null;
          this.trainStatus = st.status;
          this.trainMessage = st.status === 'done'
            ? `${st.message} Filas: ${st.rows}, MAE: ${st.mae}`
            : st.message;
        },
        error: () => {
          clearInterval(this.pollTimer!);
          this.pollTimer = null;
          this.trainStatus = 'error';
          this.trainMessage = 'Se perdió la conexión con el backend.';
        }
      });
    }, 2000);
  }

  loadPreset(key: string): void {
    const preset = this.presets[key];
    if (!preset) return;
    this.activePreset = key;
    this.payload = { ...preset.data };
  }

  get normalizedEndpoint(): string {
    const base = (this.apiUrl || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
    return `${base}/score`;
  }

  get curlCommand(): string {
    const bodyJson = JSON.stringify(this.payload, null, 2);
    return `curl -X POST "${this.normalizedEndpoint}" \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyJson}'`;
  }

  copyCurl(): void {
    navigator.clipboard.writeText(this.curlCommand);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  predictPopularity(): void {
    this.loading = true;
    this.errorMsg = '';
    this.onApiUrlChange();

    const cleanPayload: SpotifyPayload = {
      duration_ms: Number(this.payload.duration_ms),
      danceability: Number(this.payload.danceability),
      energy: Number(this.payload.energy),
      key: Number(this.payload.key),
      loudness: Number(this.payload.loudness),
      mode: Number(this.payload.mode),
      speechiness: Number(this.payload.speechiness),
      acousticness: Number(this.payload.acousticness),
      instrumentalness: Number(this.payload.instrumentalness),
      liveness: Number(this.payload.liveness),
      valence: Number(this.payload.valence),
      tempo: Number(this.payload.tempo),
      time_signature: Number(this.payload.time_signature)
    };

    this.datasetTag = this.datasetLabels[this.modelSize];
    this.http.post<{ score: number }>(this.normalizedEndpoint, cleanPayload).subscribe({
      next: (res) => {
        this.loading = false;
        this.score = res.score;
        this.scoreSubtitle = `Predicción exitosa desde ${this.normalizedEndpoint}`;
        this.history.unshift({
          timestamp: new Date().toLocaleTimeString(),
          presetName: this.presets[this.activePreset]?.label || 'Personalizado',
          datasetTag: this.datasetTag,
          score: res.score,
          apiUrl: this.normalizedEndpoint
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = `No se pudo conectar con ${this.normalizedEndpoint}. Verifica que la URL de Render esté activa.`;
        console.error(err);
      }
    });
  }
}
