/* Reduz a foto no navegador antes de enviar (busca por foto, 09/10): lado
   maior até 1024 px, JPEG 80%, orientação da câmera respeitada. Uma foto de
   celular de 4 MB vira ~150 KB e chega rápido mesmo no 4G. */

export async function otimizarImagem(
  arquivo: File,
  max = 1024,
  qualidade = 0.8,
): Promise<{ base64: string; blob: Blob }> {
  if (!/^image\//.test(arquivo.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name))
    throw new Error("não é imagem");
  if (arquivo.size > 30 * 1024 * 1024) throw new Error("foto muito grande");

  let fonte: CanvasImageSource;
  let largura: number;
  let altura: number;
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    fonte = bmp;
    largura = bmp.width;
    altura = bmp.height;
  } else {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise<HTMLImageElement>((ok, erro) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => erro(new Error("foto ilegível"));
        i.src = url;
      });
      fonte = img;
      largura = img.naturalWidth;
      altura = img.naturalHeight;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    }
  }
  const escala = Math.min(1, max / Math.max(largura, altura));
  const w = Math.max(1, Math.round(largura * escala));
  const h = Math.max(1, Math.round(altura * escala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem canvas");
  /* Fundo branco: PNG com transparência não vira preto no JPEG. */
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(fonte, 0, 0, w, h);
  const blob = await new Promise<Blob>((ok, erro) =>
    canvas.toBlob(
      (b) => (b ? ok(b) : erro(new Error("falha ao reduzir"))),
      "image/jpeg",
      qualidade,
    ),
  );
  const dataUrl = await new Promise<string>((ok, erro) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.onerror = () => erro(new Error("falha ao ler"));
    leitor.readAsDataURL(blob);
  });
  return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), blob };
}
