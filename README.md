# Adega Miami — SaaS de Gestão

Protótipo responsivo para celular e computador.

## O que já está no projeto

- Dashboard com saldo do dia e do mês
- Separação por Pix, dinheiro e cartão
- Pedidos em Kanban:
  - Vermelho = Não entregue
  - Amarelo = Em preparação
  - Verde = Entregue
- Novo pedido
- Editar e excluir pedido
- Pago / Não pago
- Pedido não pago entra automaticamente na área de dívidas
- Clientes + histórico
- Dias em atraso da dívida
- Receber dívida e registrar forma de pagamento
- Gastos do mês
- Gastos fixos/recorrentes
- Calendário financeiro com cada dia iniciando em R$ 0,00
- Perfis DONO, CAIXA e FUNCIONÁRIO
- Layout responsivo para celular e desktop
- SQL inicial para Supabase

## Testar agora

Abra `index.html` no navegador.

Sem Supabase configurado, o sistema entra em **Modo demonstração** e salva os dados no LocalStorage do navegador.

## Conectar ao Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Cole o conteúdo de `supabase.sql` e execute.
4. Em `app.js`, preencha:

```js
const SUPABASE_URL = "SUA_URL";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON";
```

## Próxima etapa recomendada

O protótipo visual já funciona localmente. Para produção, a próxima etapa é substituir as operações de LocalStorage por chamadas do Supabase, configurar autenticação real, RLS, criação de usuários por perfil e deploy HTTPS.

Também é recomendado implementar auditoria de alterações financeiras, confirmação antes de exclusões críticas e backups.


## Alterações V3

- Gastos cadastrados agora impactam o saldo pela data de vencimento, mesmo antes de serem marcados como pagos.
- Removida a área de itens/bebidas mais vendidos.
- Exportação do histórico financeiro diário em CSV.
- Pedidos podem ser consultados por dia, com botões anterior/próximo e calendário.
- Saldo positivo em verde e negativo em vermelho.
- Não pagos destacados em vermelho.
- Área de dívidas ganhou total de devedores e total a receber.
- Tipografia geral aumentada.


## Alterações V4
- O total em Gastos é agora a soma exata das contas que estão atualmente adicionadas.
- Ao adicionar uma conta, o total aumenta; ao excluir uma conta, o total diminui.
- Gastos do mês não aparecem mais em Movimentações.
- Movimentações agora possui busca por data.
- O exportador usa a data selecionada e exporta somente as entradas daquele dia.


## Alterações V5
- Removido o texto pequeno de Pix / Cartão / Dinheiro / Gastos debaixo dos cards de saldo.
- Criada uma nova área abaixo, maior e mais bonita, com o detalhamento do dia e do mês.
- O detalhamento agora fica separado em cards maiores para Pix, Cartão, Dinheiro e Gastos.


## Alterações V6
- Adicionado botão vermelho **Nova saída** ao lado de **Novo pedido** no Dashboard.
- Nova saída permite informar descrição, valor, forma e data.
- A saída registrada reduz imediatamente o saldo do dia correspondente.
- As saídas também reduzem o saldo mensal.
- Saídas aparecem em Movimentações na data escolhida e no CSV exportado.
- Calendário financeiro também considera as saídas registradas.


## Versão zerada para testes
- Sem pedidos de exemplo.
- Sem gastos de exemplo.
- Sem saídas de exemplo.
- Todos os saldos começam em R$ 0,00.
- Usa uma chave de armazenamento nova para não puxar os dados antigos da V6.


## Alterações V7
- Detalhamento do mês foi removido do Dashboard e movido para Financeiro.
- Nova área Backup abaixo de Configurações.
- Exportar backup completo em JSON.
- Importar backup e restaurar os dados.
- Backup local automático atualizado diariamente no navegador.
- Observação: navegadores não permitem download automático de arquivo sem ação do usuário; por isso o backup automático fica salvo internamente e o botão Exportar Backup faz o download quando necessário.
- Visual geral refinado com cards, navegação, botões e espaçamentos mais modernos.


## VERSÃO FINAL — RESET E CORREÇÃO DE DATA

- Sistema entregue totalmente zerado.
- Pedidos: 0.
- Gastos: R$ 0,00.
- Saídas: R$ 0,00.
- Dívidas: R$ 0,00.
- Saldos: R$ 0,00.
- Nova chave de armazenamento: dados antigos não serão carregados.
- Corrigido o cálculo de datas para usar a data LOCAL do computador/celular.
- Isso evita o problema em que, à noite no Brasil, o sistema mostrava o dia seguinte por causa do horário UTC.
- Datas de pedidos, saídas, calendário e filtros agora partem do dia local correto.


## Ajustes finais adicionais
- Ao criar um Novo Pedido, o sistema abre automaticamente a tela de Pedidos.
- Pedidos marcados como Pago passam a registrar `paid_at` imediatamente e atualizam o financeiro na hora.
- Saldo do dia e Detalhamento do dia atualizam junto com o novo pedido.
- PIX hoje, Dinheiro hoje, Cartão hoje e Entradas hoje atualizam corretamente.
- Saídas hoje ganhou destaque vermelho.
- Os cards financeiros receberam botão de olho para ocultar/exibir valores.


## Correção FINAL V3 — sincronização e datas
- Corrigido definitivamente o erro de pedidos aparecerem no dia seguinte.
- O sistema não usa mais `slice(0,10)` de timestamps UTC para decidir o dia do pedido.
- Pedidos novos registram `business_date` e `paid_date` com a data local do aparelho.
- Dashboard sincronizado: Saldo do dia = Pix + Cartão + Dinheiro − Gastos.
- O card Gastos agora soma os gastos do dia + as saídas manuais do dia.
- Nova chave de armazenamento para iniciar os testes desta correção sem dados antigos.
