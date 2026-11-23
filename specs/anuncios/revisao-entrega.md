# Critérios da revisão de entrega

1. Ao receber R$ 21.474.836,48 e a reprovação por faixa de preço da moderação, o POST retorna 201. O detalhe recupera o preço, o status rejected e o motivo price_out_of_range. Valores que excedem a precisão inteira de centavos suportada pela API retornam 400 antes da moderação.
2. Quando a moderação responde rejected sem um motivo textual preenchido em reason ou rejection_reason, o POST retorna 502 após uma chamada. A base mantém a mesma quantidade de anúncios.
