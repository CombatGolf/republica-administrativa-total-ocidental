/* ============================================================
   PLANO ÚNICO — interações do site (vanilla JS, sem dependências)
   Funciona tanto no HTML estático (GitHub Pages) quanto
   injetado pelo Next.js (eventos por delegação).
   ============================================================ */
(function () {
  "use strict";

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------- utilidades ---------- */
  function normalizar(txt) {
    return (txt || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function salvarPreferencias(dados) {
    try { localStorage.setItem("pu:a11y", JSON.stringify(dados)); } catch (e) { /* sem storage */ }
  }
  function lerPreferencias() {
    try { return JSON.parse(localStorage.getItem("pu:a11y") || "{}"); } catch (e) { return {}; }
  }

  /* ---------- acessibilidade: tema, contraste e escala ---------- */
  function initA11y() {
    var doc = document.documentElement;
    var salvar = function () {
      salvarPreferencias({
        tema: doc.getAttribute("data-theme") || "claro",
        contraste: doc.getAttribute("data-contraste") || "normal",
        escala: doc.getAttribute("data-escala") || "1"
      });
    };

    $$("[data-a11y]").forEach(function (botao) {
      var acao = botao.getAttribute("data-a11y");
      if (acao === "tema") {
        botao.setAttribute("aria-pressed", doc.getAttribute("data-theme") === "escuro" ? "true" : "false");
        botao.addEventListener("click", function () {
          var escuro = doc.getAttribute("data-theme") === "escuro";
          doc.setAttribute("data-theme", escuro ? "claro" : "escuro");
          botao.setAttribute("aria-pressed", escuro ? "false" : "true");
          salvar();
        });
      }
      if (acao === "contraste") {
        botao.setAttribute("aria-pressed", doc.getAttribute("data-contraste") === "alto" ? "true" : "false");
        botao.addEventListener("click", function () {
          var alto = doc.getAttribute("data-contraste") === "alto";
          doc.setAttribute("data-contraste", alto ? "normal" : "alto");
          botao.setAttribute("aria-pressed", alto ? "false" : "true");
          salvar();
        });
      }
      if (acao === "maior" || acao === "menor") {
        botao.addEventListener("click", function () {
          var atual = parseFloat(doc.getAttribute("data-escala") || "1");
          var passo = acao === "maior" ? 0.1 : -0.1;
          var novo = Math.min(1.3, Math.max(0.9, Math.round((atual + passo) * 10) / 10));
          doc.setAttribute("data-escala", novo.toFixed(1).length > 3 ? novo.toFixed(1) : novo.toFixed(1).replace(".0", ""));
          salvar();
        });
      }
    });
  }

  /* ---------- vitrola (carrossel) ---------- */
  function initVitrola() {
    var vitrola = $("[data-vitrola]");
    if (!vitrola) return;
    var trilho = $("[data-vitrola-trilho]", vitrola);
    var slides = $$(".slide", trilho);
    var tracos = $$("[data-vitrola-ir]", vitrola);
    var botaoPausa = $("[data-vitrola-pausa]", vitrola);
    var reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var indice = 0;
    var pausado = false;
    var timer = null;

    function temaDoSlide(i) {
      var t = slides[i].getAttribute("data-tema") || "escuro";
      vitrola.setAttribute("data-tema-slide", t);
    }
    function ir(i, semAnimacao) {
      indice = (i + slides.length) % slides.length;
      if (semAnimacao) trilho.style.transition = "none";
      trilho.style.transform = "translateX(" + (-indice * 100) + "%)";
      if (semAnimacao) { void trilho.offsetWidth; trilho.style.transition = ""; }
      tracos.forEach(function (traco, j) {
        traco.setAttribute("aria-current", j === indice ? "true" : "false");
      });
      temaDoSlide(indice);
    }
    function proximo() { ir(indice + 1); }
    function iniciar() {
      if (timer || reduzMovimento || pausado) return;
      timer = setInterval(function () {
        if (!document.hidden) proximo();
      }, 6500);
    }
    function parar() { if (timer) { clearInterval(timer); timer = null; } }

    tracos.forEach(function (traco) {
      traco.addEventListener("click", function () {
        ir(parseInt(traco.getAttribute("data-vitrola-ir"), 10));
        parar(); iniciar();
      });
    });
    if (botaoPausa) {
      botaoPausa.addEventListener("click", function () {
        pausado = !pausado;
        botaoPausa.setAttribute("aria-pressed", pausado ? "true" : "false");
        var rotulo = $(".so-leitor", botaoPausa);
        if (rotulo) rotulo.textContent = pausado ? "Retomar rotação automática" : "Pausar rotação automática";
        if (pausado) parar(); else iniciar();
      });
    }
    vitrola.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight") { proximo(); parar(); iniciar(); }
      if (ev.key === "ArrowLeft") { ir(indice - 1); parar(); iniciar(); }
    });
    vitrola.addEventListener("mouseenter", parar);
    vitrola.addEventListener("mouseleave", function () { if (!pausado) iniciar(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) parar(); else if (!pausado) iniciar();
    });
    /* toque: deslizar para trocar */
    var toqueX = null;
    vitrola.addEventListener("touchstart", function (ev) { toqueX = ev.touches[0].clientX; }, { passive: true });
    vitrola.addEventListener("touchend", function (ev) {
      if (toqueX === null) return;
      var delta = ev.changedTouches[0].clientX - toqueX;
      if (Math.abs(delta) > 48) { ir(indice + (delta < 0 ? 1 : -1)); parar(); iniciar(); }
      toqueX = null;
    }, { passive: true });

    ir(0, true);
    iniciar();
  }

  /* ---------- diálogos dos eixos ---------- */
  var focoDeOrigem = null;
  function abrirDialogo(dialogo) {
    if (dialogo.open) return;
    if (typeof dialogo.showModal !== "function") { dialogo.setAttribute("open", ""); return; }
    try {
      dialogo.showModal();
    } catch (e) {
      dialogo.setAttribute("open", "");
    }
  }
  function initDialogos() {
    document.addEventListener("click", function (ev) {
      var abre = ev.target.closest("[data-abre-eixo]");
      if (abre) {
        var dialogo = document.getElementById("dialog-eixo-" + abre.getAttribute("data-abre-eixo"));
        if (dialogo) { focoDeOrigem = abre; abrirDialogo(dialogo); }
        return;
      }
      var fecha = ev.target.closest("[data-fecha-dialog]");
      if (fecha) {
        var d = fecha.closest("dialog");
        if (d && d.open) d.close();
        return;
      }
      /* clique no fundo escurecido fecha */
      if (ev.target instanceof HTMLDialogElement && ev.target.open) ev.target.close();
    });
    document.addEventListener("close", function (ev) {
      if (ev.target instanceof HTMLDialogElement && focoDeOrigem && document.contains(focoDeOrigem)) {
        focoDeOrigem.focus(); focoDeOrigem = null;
      }
    }, true);
  }

  /* ---------- aviso de abertura (uma vez por navegador) ---------- */
  function initAvisoAbertura() {
    var dialogo = $("#pu-aviso-abertura");
    if (!dialogo) return;
    var jaVisto = false;
    try { jaVisto = localStorage.getItem("pu:aviso-abertura") === "1"; } catch (e) { /* sem storage: mostra */ }
    if (jaVisto) return;
    dialogo.addEventListener("close", function () {
      try { localStorage.setItem("pu:aviso-abertura", "1"); } catch (e) {}
    });
    setTimeout(function () { abrirDialogo(dialogo); }, 400);
  }

  /* ---------- setas das trilhas ---------- */
  function initSetas() {
    $$("[data-trilha]").forEach(function (trilha) {
      var conjunto = trilha.closest("section") || trilha.parentElement;
      var setas = $("[data-trilha-setas]", conjunto);
      if (!setas) return;
      var atualizar = function () {
        var sobra = trilha.scrollWidth - trilha.clientWidth;
        setas.hidden = sobra < 24;
        $("[data-trilha-seta='anterior']", setas).disabled = trilha.scrollLeft <= 4;
        $("[data-trilha-seta='proximo']", setas).disabled = trilha.scrollLeft >= sobra - 4;
      };
      $$("[data-trilha-seta]", setas).forEach(function (seta) {
        seta.addEventListener("click", function () {
          var cartao = trilha.querySelector(".eixo-card");
          var passo = cartao ? (cartao.offsetWidth + 18) * 2 : trilha.clientWidth * .8;
          trilha.scrollBy({ left: seta.getAttribute("data-trilha-seta") === "proximo" ? passo : -passo, behavior: "smooth" });
        });
      });
      trilha.addEventListener("scroll", atualizar, { passive: true });
      window.addEventListener("resize", atualizar);
      atualizar();
    });
  }

  /* ---------- busca ---------- */
  function initBusca() {
    var indiceItens = null;
    function montarIndice() {
      indiceItens = [];
      $$("dialog.eixo-dialog").forEach(function (dialogo) {
        var eixoNum = dialogo.getAttribute("data-eixo-num");
        var eixoNome = dialogo.getAttribute("data-eixo-nome") || "";
        var cor = dialogo.getAttribute("data-cor") || "#e01f2d";
        $$(".item", dialogo).forEach(function (item) {
          var tituloOriginal = $(".item__titulo", item).textContent;
          var resumoEl = $(".item__resumo", item);
          var resumoOriginal = resumoEl ? resumoEl.textContent : "";
          indiceItens.push({
            eixoNum: eixoNum, eixoNome: eixoNome, cor: cor,
            num: item.getAttribute("data-item") || "",
            tituloBusca: normalizar(tituloOriginal),
            resumoBusca: normalizar(resumoOriginal),
            tituloOriginal: tituloOriginal,
            resumoOriginal: resumoOriginal,
            elemento: item,
            dialogo: dialogo
          });
        });
      });
    }
    function abrirResultado(r) {
      abrirDialogo(r.dialogo);
      setTimeout(function () {
        r.elemento.scrollIntoView({ behavior: "smooth", block: "center" });
        r.elemento.classList.remove("piscando");
        void r.elemento.offsetWidth;
        r.elemento.classList.add("piscando");
      }, 120);
    }
    $$("[data-busca]").forEach(function (campo) {
      var painel = $(".busca__resultados", campo.closest(".busca"));
      if (!painel) return;
      var itens = [];

      function esconder() { painel.hidden = true; itens = []; }
      function render(resultados) {
        painel.innerHTML = "";
        itens = [];
        if (!resultados.length) {
          var vazio = document.createElement("p");
          vazio.className = "busca__vazio";
          vazio.textContent = "Nada encontrado nas 89 propostas do plano.";
          painel.appendChild(vazio);
        }
        resultados.forEach(function (r, i) {
          var botao = document.createElement("button");
          botao.type = "button";
          botao.className = "resultado";
          botao.style.setProperty("--cor-tema", r.cor);
          var eixo = document.createElement("span");
          eixo.className = "resultado__eixo";
          eixo.textContent = "Eixo " + r.eixoNum;
          var texto = document.createElement("span");
          texto.className = "resultado__texto";
          var titulo = document.createElement("span");
          titulo.className = "resultado__titulo";
          titulo.textContent = "Item " + r.num + " — " + r.tituloOriginal;
          var resumo = document.createElement("span");
          resumo.className = "resultado__resumo";
          resumo.textContent = r.resumoOriginal;
          texto.appendChild(titulo); texto.appendChild(resumo);
          botao.appendChild(eixo); botao.appendChild(texto);
          botao.addEventListener("click", function () { esconder(); campo.value = ""; abrirResultado(r); });
          painel.appendChild(botao);
          itens.push(botao);
        });
        painel.hidden = false;
      }
      campo.addEventListener("input", function () {
        if (!indiceItens) montarIndice();
        var termo = normalizar(campo.value.trim());
        if (termo.length < 2) { esconder(); return; }
        var resultados = indiceItens
          .map(function (r) {
            if (r.tituloBusca.indexOf(termo) >= 0) return { r: r, pontuacao: 2 };
            if (r.resumoBusca.indexOf(termo) >= 0) return { r: r, pontuacao: 1 };
            return null;
          })
          .filter(Boolean)
          .sort(function (a, b) { return b.pontuacao - a.pontuacao; })
          .slice(0, 8)
          .map(function (x) {
            return {
              eixoNum: x.r.eixoNum, eixoNome: x.r.eixoNome, cor: x.r.cor,
              num: x.r.num, tituloOriginal: x.r.tituloOriginal,
              resumoOriginal: x.r.resumoOriginal,
              elemento: x.r.elemento, dialogo: x.r.dialogo
            };
          });
        render(resultados);
      });
      campo.addEventListener("keydown", function (ev) {
        if (painel.hidden) return;
        var atual = itens.indexOf(painel.querySelector(".resultado.destacado"));
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          ev.preventDefault();
          var novo = ev.key === "ArrowDown" ? atual + 1 : atual - 1;
          novo = Math.min(itens.length - 1, Math.max(0, novo));
          itens.forEach(function (b) { b.classList.remove("destacado"); });
          itens[novo].classList.add("destacado");
          itens[novo].scrollIntoView({ block: "nearest" });
        } else if (ev.key === "Enter") {
          if (atual >= 0) itens[atual].click();
          else if (itens.length) itens[0].click();
        } else if (ev.key === "Escape") {
          esconder();
        }
      });
      document.addEventListener("click", function (ev) {
        if (!ev.target.closest(".busca")) esconder();
      });
    });
  }

  /* ---------- gaveta mobile ---------- */
  function initGaveta() {
    var gaveta = $("[data-gaveta]");
    var botao = $("[data-gaveta-botao]");
    var veu = $("[data-veu]");
    if (!gaveta || !botao) return;
    function alternar(abrir) {
      gaveta.setAttribute("data-aberta", abrir ? "true" : "false");
      if (veu) veu.setAttribute("data-visivel", abrir ? "true" : "false");
      botao.setAttribute("aria-expanded", abrir ? "true" : "false");
      var rotulo = $("[data-gaveta-rotulo]", botao);
      if (rotulo) rotulo.textContent = abrir ? "Fechar menu" : "Abrir menu";
      document.body.style.overflow = abrir ? "hidden" : "";
      if (abrir) gaveta.focus();
    }
    $$("[data-gaveta-botao]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        alternar(gaveta.getAttribute("data-aberta") !== "true");
      });
    });
    if (veu) veu.addEventListener("click", function () { alternar(false); });
    $$("a", gaveta).forEach(function (link) {
      link.addEventListener("click", function () { alternar(false); });
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && gaveta.getAttribute("data-aberta") === "true") alternar(false);
    });
  }

  /* ---------- cabeçalho com sombra ao rolar ---------- */
  function initCabecalho() {
    var cab = $(".cabecalho");
    if (!cab) return;
    var atualizar = function () { cab.classList.toggle("rolou", window.scrollY > 8); };
    window.addEventListener("scroll", atualizar, { passive: true });
    atualizar();
  }

  /* ---------- revelação ao rolar ---------- */
  function initRevelacao() {
    var alvos = $$("[data-reveal]");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      alvos.forEach(function (el) { el.classList.add("visto"); });
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visto");
          obs.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "120px 0px" });
    alvos.forEach(function (el) { obs.observe(el); });
    /* garantia: nada fica invisível para sempre (capturas, leitores, âncoras) */
    setTimeout(function () {
      alvos.forEach(function (el) { el.classList.add("visto"); });
    }, 4000);
  }

  /* ---------- vista "Plano na íntegra" (troca sem recarregar) ---------- */
  function initPlano() {
    var plano = document.getElementById("vista-plano");
    if (!plano) return;

    var secoes = $$(".plano__eixo", plano);
    var navegaveis = $$(".plano__nav-item, .plano__chip", plano);
    var rolagemSite = 0;
    var ultimoEixo = 1;

    function eixoAtivo() {
      for (var i = 0; i < secoes.length; i++) {
        if (secoes[i].classList.contains("ativo")) return parseInt(secoes[i].getAttribute("data-eixo"), 10);
      }
      return 0;
    }

    function mostrarEixo(n, focar) {
      n = Math.min(13, Math.max(1, n || 1));
      ultimoEixo = n;
      secoes.forEach(function (s) {
        s.classList.toggle("ativo", s.getAttribute("data-eixo") === String(n));
      });
      navegaveis.forEach(function (b) {
        var chip = b.classList.contains("plano__chip");
        if (b.getAttribute("data-eixo-alvo") === String(n)) {
          b.setAttribute("aria-current", "true");
          if (chip) {
            b.classList.add("atual");
            if (b.offsetParent) b.scrollIntoView({ block: "nearest", inline: "center" });
          }
        } else {
          b.removeAttribute("aria-current");
          if (chip) b.classList.remove("atual");
        }
      });
      var secao = $('.plano__eixo[data-eixo="' + n + '"]', plano);
      if (secao && secao.scrollIntoView) secao.scrollIntoView({ block: "start" });
      if (focar) {
        var titulo = $(".plano__cabeca__titulo", secao);
        if (titulo) { titulo.focus({ preventScroll: true }); }
      }
    }

    function entrarPlano(n) {
      if (document.body.getAttribute("data-vista") !== "plano") {
        rolagemSite = window.scrollY || 0;
        document.body.setAttribute("data-vista", "plano");
        window.scrollTo(0, 0);
      }
      mostrarEixo(n || eixoAtivo() || ultimoEixo, true);
    }

    function sairPlano() {
      if (document.body.getAttribute("data-vista") !== "plano") return;
      document.body.removeAttribute("data-vista");
      requestAnimationFrame(function () { window.scrollTo(0, rolagemSite || 0); });
    }

    function rotear() {
      var h = location.hash || "";
      var m = /^#plano-eixo-(\d+)$/.exec(h);
      if (m) { entrarPlano(parseInt(m[1], 10)); return; }
      if (h === "#plano") { entrarPlano(eixoAtivo() || ultimoEixo); return; }
      sairPlano();
    }
    window.addEventListener("hashchange", rotear);
    rotear();

    /* botões internos (lateral, chips, anterior/próximo): troca na hora,
       sem empilhar no histórico do navegador */
    plano.addEventListener("click", function (ev) {
      var alvo = ev.target.closest("[data-eixo-alvo]");
      if (alvo) {
        var n = parseInt(alvo.getAttribute("data-eixo-alvo"), 10);
        try { history.replaceState(history.state, "", "#plano-eixo-" + n); } catch (e) { /* sem history */ }
        if (document.body.getAttribute("data-vista") !== "plano") entrarPlano(n);
        else mostrarEixo(n, true);
        return;
      }
      if (ev.target.closest("[data-volta-plano]")) { location.hash = ""; return; }
      if (ev.target.closest("[data-imprimir-plano]")) { window.print(); }
    });

    /* "Ler a redação completa" dentro de um diálogo: fecha o diálogo ao navegar */
    document.addEventListener("click", function (ev) {
      var link = ev.target.closest('a[href^="#plano"]');
      if (link) {
        var d = link.closest("dialog");
        if (d && d.open) d.close();
      }
    }, true);

    /* Esc volta ao site quando a vista do plano está aberta e nenhum diálogo também */
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (document.body.getAttribute("data-vista") !== "plano") return;
      if ($("dialog[open]")) return;
      location.hash = "";
    });
  }

  /* ---------- boot ---------- */
  function iniciarTudo() {
    initA11y();
    initVitrola();
    initDialogos();
    initAvisoAbertura();
    initSetas();
    initBusca();
    initGaveta();
    initCabecalho();
    initRevelacao();
    initPlano();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarTudo);
  } else {
    iniciarTudo();
  }
})();
