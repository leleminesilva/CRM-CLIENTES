import type { ModoCalculoProduto } from "@prisma/client";

/**
 * Estrutura de catálogo mapeada ao vivo do Alumy (manageasy.com.br) em 2026-07-22.
 * Só estrutura, sem preços/variantes — isso é dado comercial real do usuário,
 * ele preenche depois pela tela de Catálogo.
 *
 * As 23 linhas abaixo são os nomes reais vistos no seletor "Selecione ou digite
 * o nome da linha" do orçamento. Só VIDROS e CORRIMÃO tiveram produtos
 * confirmados (foram abertos e inspecionados); as demais linhas ficam sem
 * produto pré-cadastrado — não vale a pena inventar nomes de produto que não
 * foram vistos de verdade.
 */
export const CATALOGO_ALUMY: {
  nome: string;
  produtos?: { nome: string; modoCalculo: ModoCalculoProduto }[];
}[] = [
  {
    nome: "VIDROS",
    produtos: [
      { nome: "VIDROS COMUNS COLOCADOS", modoCalculo: "AREA" },
      { nome: "VIDROS COMUNS CORTADO", modoCalculo: "AREA" },
      { nome: "VIDROS LAMINADOS", modoCalculo: "AREA" },
      { nome: "VIDROS REDONDOS", modoCalculo: "AREA" },
      { nome: "VIDROS TEMPERADOS", modoCalculo: "AREA" },
      { nome: "VIDROS TEMPERADOS CANTO GARRAFA", modoCalculo: "AREA" },
      { nome: "VIDROS TEMPERADOS CANTO MOEDA", modoCalculo: "AREA" },
    ],
  },
  {
    nome: "CORRIMÃO",
    produtos: [{ nome: "CORRIMÃO ACHATADO (D-095)", modoCalculo: "LINEAR" }],
  },
  { nome: "BOX" },
  { nome: "COBERTURA" },
  { nome: "CONTRA MARCO" },
  { nome: "ESPELHOS" },
  { nome: "FECHAMENTO DE SACADA" },
  { nome: "GRADES DE ALUMÍNIO" },
  { nome: "GUARDA CORPO" },
  { nome: "IMPOSTO" },
  { nome: "LINHA 20" },
  { nome: "LINHA 25" },
  { nome: "LINHA DE BRISES" },
  { nome: "LINHA DE PORTÃO" },
  { nome: "LINHA GOLD" },
  { nome: "LINHA SUPREMA" },
  { nome: "MÃO DE OBRA" },
  { nome: "PELE DE VIDRO" },
  { nome: "PLACAS DE VIDRO" },
  { nome: "PRATELEIRAS" },
  { nome: "PRODUTOS PRONTOS" },
  { nome: "REPOSIÇÃO VIDRO TEMPERADO" },
  { nome: "TELA MOSQUITEIRO" },
  { nome: "VIDRO TEMPERADO" },
];
