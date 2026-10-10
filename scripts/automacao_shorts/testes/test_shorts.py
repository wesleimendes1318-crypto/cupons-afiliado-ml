"""python -m unittest discover -s scripts/automacao_shorts/testes -t ."""

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from scripts.automacao_shorts import gerador_roteiro, regras, youtube_publisher
from scripts.automacao_shorts.config import carregar
from scripts.automacao_shorts.radar_produtos import Produto, foto_original_jpeg, motivo_de_recusa


def produto(**kw) -> Produto:
    base = dict(
        chave="MLB123",
        titulo="Fone De Ouvido JBL Tune 520BT Bluetooth Preto",
        imagem="https://http2.mlstatic.com/D_NQ_NP_847869-MLA100002014617_112025-O.webp",
        preco=199.9,
        antes=299.9,
        economia=100.0,
        link="https://meli.la/1AbCd",
        tipo="mesmo",
        frete_gratis=True,
        conferido_em=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        caracteristicas=["Duração da bateria: 57 h", "Versão do Bluetooth: 5.3", "Cor: Preto"],
    )
    base.update(kw)
    return Produto(**base)


class Links(unittest.TestCase):
    def test_afiliado_por_marketplace(self):
        self.assertTrue(regras.link_de_afiliado_valido("https://meli.la/2asyJ5k"))
        self.assertFalse(regras.link_de_afiliado_valido("https://www.mercadolivre.com.br/p/MLB1"))
        self.assertTrue(
            regras.link_de_afiliado_valido("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=melhoresc0fff-20", "amazon")
        )
        self.assertFalse(
            regras.link_de_afiliado_valido("https://www.amazon.com.br/dp/B0ABCDEFGH?tag=outro-20", "amazon")
        )
        self.assertTrue(regras.link_de_afiliado_valido("https://amzn.to/3xyz", "amazon"))
        self.assertTrue(regras.link_de_afiliado_valido("https://s.shopee.com.br/AbC123", "shopee"))
        self.assertFalse(regras.link_de_afiliado_valido("https://shopee.com.br/produto-i.1.2", "shopee"))


class Radar(unittest.TestCase):
    def test_recusas(self):
        self.assertIsNone(motivo_de_recusa(produto(), 24))
        self.assertIn("parecido", motivo_de_recusa(produto(tipo="parecido"), 24))
        self.assertEqual(motivo_de_recusa(produto(link="https://bit.ly/x"), 24), "link sem afiliado")
        self.assertEqual(motivo_de_recusa(produto(titulo="Fone i12 TWS Bluetooth"), 24), "parece falso")
        self.assertEqual(motivo_de_recusa(produto(titulo="iPhone 13 Usado 128GB"), 24), "usado/defeito")
        self.assertEqual(
            motivo_de_recusa(produto(titulo="Carcaça Controle Sa 203"), 24), "peça no lugar do aparelho"
        )
        self.assertEqual(motivo_de_recusa(produto(economia=5, preco=295, antes=300), 24), "sem desconto real")
        velho = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
        self.assertIn("24 h", motivo_de_recusa(produto(conferido_em=velho), 24))

    def test_foto_original(self):
        self.assertEqual(
            foto_original_jpeg("https://http2.mlstatic.com/D_NQ_NP_847869-MLA100002014617_112025-O.webp"),
            "https://http2.mlstatic.com/D_NQ_NP_847869-MLA100002014617_112025-F.jpg",
        )


class Roteiro(unittest.TestCase):
    def test_base_valido_e_sem_numero_inventado(self):
        p = produto()
        r = gerador_roteiro.roteiro_base(p)
        self.assertEqual(gerador_roteiro.validar(r, p), [])
        self.assertTrue(25 <= r.segundos_estimados <= 46, r.segundos_estimados)
        comp = next(t for t in r.trechos if t.parte == "comparacao")
        self.assertIn("299 reais e 90 centavos", comp.fala)
        self.assertIn("R$ 199,90", comp.legenda)
        self.assertIn("frete sai grátis", comp.fala)

    def test_frete_nao_confirmado(self):
        p = produto(frete_gratis=None)
        r = gerador_roteiro.roteiro_base(p)
        comp = next(t for t in r.trechos if t.parte == "comparacao")
        self.assertNotIn("grátis", comp.fala.lower())
        self.assertIn("Frete a consultar no anúncio", comp.legenda)
        meta = gerador_roteiro.metadados_seo(p, r)
        self.assertIn("Frete a consultar no anúncio.", meta["descricao"])

    def test_validacao_pega_numero_e_frase_de_robo(self):
        p = produto()
        r = gerador_roteiro.roteiro_base(p)
        r.trechos[1].fala += " A bateria dura 90 horas. Neste vídeo vamos explorar."
        problemas = " ".join(gerador_roteiro.validar(r, p))
        self.assertIn("90", problemas)
        self.assertIn("neste vídeo", problemas)
        r2 = gerador_roteiro.roteiro_base(p)
        r2.trechos[2].fala += " Antes era 350 reais."
        self.assertIn("350", " ".join(gerador_roteiro.validar(r2, p)))

    def test_seo(self):
        p = produto()
        meta = gerador_roteiro.metadados_seo(p, gerador_roteiro.roteiro_base(p))
        self.assertLessEqual(len(meta["titulo"]), 70)
        self.assertTrue(meta["titulo"].endswith("#Shorts"))
        self.assertTrue(3 <= len(meta["hashtags"]) <= 4)
        self.assertIn("#JBL", meta["hashtags"])
        self.assertTrue(8 <= len(meta["tags"]) <= 12, meta["tags"])
        self.assertIn("https://meli.la/1AbCd", meta["descricao"])
        self.assertIn("programas de afiliados", meta["descricao"])
        self.assertNotIn("review", " ".join(meta["tags"]))

    def test_dinheiro(self):
        self.assertEqual(regras.brl(1299.9), "R$ 1.299,90")
        self.assertEqual(regras.preco_falado(109.01), "109 reais e 1 centavo")
        self.assertEqual(regras.preco_falado(1), "1 real")
        self.assertEqual(regras.unidades_faladas('32 "'), "32 polegadas")


class Cota(unittest.TestCase):
    def test_teto_de_videos_e_unidades(self):
        cfg = carregar()
        with tempfile.TemporaryDirectory() as d:
            original = youtube_publisher.COTA
            youtube_publisher.COTA = Path(d) / "cota.json"
            try:
                self.assertTrue(youtube_publisher.pode_enviar(cfg)[0])
                for _ in range(cfg.max_videos_dia):
                    youtube_publisher._gastar(1650, video=True)
                ok, motivo = youtube_publisher.pode_enviar(cfg)
                self.assertFalse(ok)
                self.assertIn("teto", motivo)
            finally:
                youtube_publisher.COTA = original


if __name__ == "__main__":
    unittest.main()
