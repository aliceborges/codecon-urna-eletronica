import audioBotaoUrna from "../assets/audios/botao.mp3";

const inicioSomBotao = 0.053;
const audioAlternativo = new Audio(audioBotaoUrna);
audioAlternativo.preload = "auto";

let contextoAudio: AudioContext | null = null;
let bufferAudio: AudioBuffer | null = null;
let carregamentoAudio: Promise<AudioBuffer | null> | null = null;

function obterContextoAudio() {
  if (contextoAudio) return contextoAudio;

  const JanelaAudioContext =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!JanelaAudioContext) return null;

  contextoAudio = new JanelaAudioContext();
  return contextoAudio;
}

function carregarAudioBotao() {
  if (bufferAudio) return Promise.resolve(bufferAudio);
  if (carregamentoAudio) return carregamentoAudio;

  const contexto = obterContextoAudio();
  if (!contexto) return Promise.resolve(null);

  carregamentoAudio = fetch(audioBotaoUrna)
    .then((resposta) => resposta.arrayBuffer())
    .then((dados) => contexto.decodeAudioData(dados))
    .then((buffer) => {
      bufferAudio = buffer;
      return buffer;
    })
    .catch(() => null);

  return carregamentoAudio;
}

function reproduzirComWebAudio(contexto: AudioContext, buffer: AudioBuffer) {
  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(contexto.destination);
  fonte.start(0, Math.min(inicioSomBotao, buffer.duration));
}

function reproduzirComAudioAlternativo() {
  audioAlternativo.pause();
  audioAlternativo.currentTime = 0;
  void audioAlternativo.play().catch(() => undefined);
}

export function prepararAudioBotao() {
  void carregarAudioBotao();
}

export function tocarAudioBotao() {
  const contexto = obterContextoAudio();

  if (!contexto) {
    reproduzirComAudioAlternativo();
    return;
  }

  const retomada =
    contexto.state === "running" ? Promise.resolve() : contexto.resume();

  void Promise.all([retomada, carregarAudioBotao()])
    .then(([, buffer]) => {
      if (buffer) reproduzirComWebAudio(contexto, buffer);
      else reproduzirComAudioAlternativo();
    })
    .catch(() => reproduzirComAudioAlternativo());
}
