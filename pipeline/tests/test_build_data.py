"""Guards for how blog posts find their stop (pipeline/build_data.py).

Run with ``python -m unittest pipeline.tests.test_build_data``. Offline: the
rules are checked on titles and sentences taken from the archive itself.
"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pipeline"))
SPEC = importlib.util.spec_from_file_location("build_data", ROOT / "pipeline" / "build_data.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class TitreNommeEscaleTests(unittest.TestCase):
    def test_a_title_names_the_stop_it_tells(self) -> None:
        self.assertTrue(MODULE.nomme_escale(
            "Vanua Lailai, beau au-dessus, beau en-dessous.", "Fidji - Vanua Lailai"))

    def test_a_destination_does_not_name_the_stop(self) -> None:
        # « En route pour Rangiroa. » tells the stop at Toau
        self.assertFalse(MODULE.nomme_escale("En route pour Rangiroa.", "Tuamotu - Rangiroa"))
        self.assertFalse(MODULE.nomme_escale("Sur la route de Port Mc Neil", "Port Mc Neil"))
        self.assertEqual(
            MODULE.mots_cites("Traversée de Rarotonga vers Beveridge Reef.", "Beveridge Reef")[0], 0)
        self.assertEqual(
            MODULE.mots_cites("Traversée de Rarotonga vers Beveridge Reef.", "Cook du sud - Rarotonga")[0], 1)

    def test_the_fuller_name_wins(self) -> None:
        nuku = MODULE.mots_cites("Arrivée à Nuku Hiva", "Marquises - Nuku Hiva")
        hiva_oa = MODULE.mots_cites("Arrivée à Nuku Hiva", "Marquises - Hiva Oa")
        self.assertGreater(nuku, hiva_oa)
        # « oa » is too short to count: the whole name of Hiva Oa is cited
        noel_hiva_oa = MODULE.mots_cites("Noël à Hiva Oa", "Marquises - Hiva Oa")
        noel_nuku = MODULE.mots_cites("Noël à Hiva Oa", "Marquises - Nuku Hiva")
        self.assertGreater(noel_hiva_oa, noel_nuku)


class PhraseQuiCiteTests(unittest.TestCase):
    def test_the_sentence_is_kept_word_for_word(self) -> None:
        blocs = ["Après une nuit passée face à la marina, nous sommes partis vers "
                 "d'autres aventures, en la prestigieuse île d'Arcy. Comme d'habitude, "
                 "quand il n'y a pas de petite ancre dans la baie sur les cartes marines, "
                 "il n'y a personne au mouillage.", 0]
        self.assertEqual(
            MODULE.phrase_qui_cite(blocs, {"arcy"}),
            "Après une nuit passée face à la marina, nous sommes partis vers "
            "d'autres aventures, en la prestigieuse île d'Arcy.")

    def test_a_long_sentence_is_cut_at_a_comma_after_the_name(self) -> None:
        phrase = ("Après un bref séjour à Tahuata, l'île voisine, où j'ai pu valider que mes "
                  "aptitudes au harpon n'ont pas progressé depuis notre dernière visite, nous "
                  "sommes revenus à Hiva Oa, le temps de récupérer nos vasques, notre "
                  "casse-tête et notre pagaie de guerre, sans oublier notre chipsier (c'est "
                  "comme un saladier mais pour les chips).")
        extrait = MODULE.phrase_qui_cite([phrase], {"tahuata"})
        self.assertTrue(extrait.endswith("…"))
        self.assertTrue(phrase.startswith(extrait[:-1]))
        self.assertIn("Tahuata", extrait)

    def test_no_sentence_without_the_whole_name(self) -> None:
        self.assertIsNone(MODULE.phrase_qui_cite(["Nous avons quitté Neah."], {"neah", "francisco"}))


if __name__ == "__main__":
    unittest.main()
