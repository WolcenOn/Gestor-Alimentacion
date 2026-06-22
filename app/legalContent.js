import { escapeHtml } from "./utils.js";

const LEGAL_ACCEPTANCE_KEY = "gestorMenuSemanal.legalAcceptance.v1";
const LEGAL_VERSION = "2026-06-21-draft";

const documents = {
  privacy: {
    title: "Privacidad",
    eyebrow: "Borrador legal",
    updatedAt: "2026-06-21",
    sections: [
      {
        title: "Responsable y contacto",
        paragraphs: [
          "Responsable pendiente de completar antes de producción pública: nombre legal, email de privacidad y datos identificativos.",
          "Hasta completar esos datos, este texto sirve como base de transparencia para beta privada y revisión legal."
        ]
      },
      {
        title: "Datos que puede tratar la app",
        list: [
          "Cuenta: email, nombre visible e identificador de usuario.",
          "Hogar: nombre del hogar, miembros, roles e invitaciones.",
          "Uso: ingredientes, platos, menús, stock, recetas, compras, preferencias y exportaciones.",
          "Nutrición, glucosa o metabolismo solo si la persona usuaria decide introducirlos.",
          "Datos técnicos mínimos para seguridad, diagnóstico y disponibilidad."
        ]
      },
      {
        title: "Finalidades",
        list: [
          "Crear y mantener la cuenta.",
          "Planificar menús, compras, stock e ingredientes.",
          "Sincronizar datos entre dispositivos si se activa el modo cloud.",
          "Gestionar hogares compartidos, invitaciones y roles.",
          "Mantener la seguridad del servicio y resolver incidencias."
        ]
      },
      {
        title: "Datos de salud o especialmente sensibles",
        paragraphs: [
          "La app puede contener información nutricional, metabólica o de glucosa si la introduces. Esa información puede ser sensible.",
          "La app no es un producto sanitario, no diagnostica, no prescribe y no debe usarse para ajustar medicación, insulina o tratamientos.",
          "Puedes usar la app en modo local si no quieres sincronizar estos datos en la nube."
        ]
      },
      {
        title: "Tus derechos y control",
        list: [
          "Puedes exportar datos JSON desde la app.",
          "Puedes borrar datos locales del navegador.",
          "El borrado local no elimina datos ya sincronizados en cloud.",
          "Antes de producción pública debe habilitarse proceso de borrado cloud/cuenta o un canal de solicitud por email."
        ]
      }
    ]
  },
  terms: {
    title: "Términos de uso",
    eyebrow: "Borrador legal",
    updatedAt: "2026-06-21",
    sections: [
      {
        title: "Naturaleza del servicio",
        paragraphs: [
          "Gestor de Alimentación es una herramienta de organización doméstica para menús, ingredientes, stock, compras, recetas, nutrición orientativa y sincronización entre dispositivos.",
          "La información nutricional o metabólica es orientativa y puede depender de fuentes externas incompletas o con errores."
        ]
      },
      {
        title: "No es consejo médico",
        paragraphs: [
          "La app no sustituye a profesionales médicos, nutricionistas ni sanitarios.",
          "No debe utilizarse para decisiones urgentes de salud, dietas clínicas, medicación, insulina o tratamientos."
        ]
      },
      {
        title: "Cuenta y hogares compartidos",
        list: [
          "La persona usuaria debe proteger sus credenciales.",
          "Quien invite a otras personas a un hogar debe asegurarse de que puede compartir esos datos.",
          "Los hogares pueden contener hábitos alimentarios, compras, preferencias o información sensible si se introduce."
        ]
      },
      {
        title: "Datos y copias",
        list: [
          "La app ofrece exportación JSON y borrado local.",
          "Se recomienda exportar copias si los datos son importantes.",
          "La eliminación cloud/cuenta debe implementarse o canalizarse antes de producción pública."
        ]
      },
      {
        title: "Fuentes externas y disponibilidad",
        paragraphs: [
          "La app puede consultar Open Food Facts, USDA FoodData Central u otras fuentes. Esos datos deben revisarse antes de usarlos.",
          "El servicio puede sufrir interrupciones por mantenimiento, red, proveedores externos o límites de API."
        ]
      }
    ]
  },
  cloudConsent: {
    title: "Consentimiento cloud",
    eyebrow: "Datos nutricionales, glucosa o metabolismo",
    updatedAt: "2026-06-21",
    sections: [
      {
        title: "Antes de sincronizar",
        paragraphs: [
          "Al activar la sincronización cloud aceptas que los datos del hogar se guarden en el backend configurado.",
          "Estos datos pueden incluir alimentos, menús, compras, nutrición y, si los introduces, datos de glucosa, metabolismo u otra información de salud."
        ]
      },
      {
        title: "Alternativa local",
        paragraphs: [
          "Puedes seguir usando la app en modo local si no quieres sincronizar estos datos.",
          "Este consentimiento debe poder retirarse en una versión de producción pública."
        ]
      }
    ]
  }
};

export function getLegalAcceptance() {
  try {
    return JSON.parse(localStorage.getItem(LEGAL_ACCEPTANCE_KEY) || "null") || null;
  } catch {
    return null;
  }
}

export function hasAcceptedCurrentLegalVersion() {
  const acceptance = getLegalAcceptance();
  return acceptance?.version === LEGAL_VERSION && acceptance?.accepted === true;
}

export function recordLegalAcceptance() {
  const acceptance = {
    accepted: true,
    version: LEGAL_VERSION,
    acceptedAt: new Date().toISOString(),
    documents: ["privacy", "terms", "cloudConsent"]
  };
  localStorage.setItem(LEGAL_ACCEPTANCE_KEY, JSON.stringify(acceptance));
  window.dispatchEvent(new CustomEvent("gestor:legal-acceptance", { detail: acceptance }));
  return acceptance;
}

export function renderLegalModal(type = "privacy") {
  const document = documents[type] || documents.privacy;
  const accepted = hasAcceptedCurrentLegalVersion();
  return `
    <header>
      <div>
        <p class="eyebrow">${escapeHtml(document.eyebrow)}</p>
        <h2>${escapeHtml(document.title)}</h2>
        <p class="muted">Versión ${escapeHtml(LEGAL_VERSION)} · actualizado ${escapeHtml(document.updatedAt)}</p>
      </div>
      <button class="secondary" data-action="close-modal" aria-label="Cerrar">×</button>
    </header>
    <div class="legal-modal-body stack-form">
      <p class="alert">Estos textos son borradores de producto. Antes de producción pública deben completarse con datos reales y revisión legal.</p>
      ${document.sections.map(section => `
        <section class="help-note">
          <h3>${escapeHtml(section.title)}</h3>
          ${(section.paragraphs || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          ${section.list ? `<ul>${section.list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        </section>
      `).join("")}
      <div class="help-note">
        <h3>Documentos relacionados</h3>
        <div class="actions wrap">
          <button type="button" class="secondary" data-action="open-legal-doc" data-legal-doc="privacy">Privacidad</button>
          <button type="button" class="secondary" data-action="open-legal-doc" data-legal-doc="terms">Términos</button>
          <button type="button" class="secondary" data-action="open-legal-doc" data-legal-doc="cloudConsent">Consentimiento cloud</button>
        </div>
      </div>
      <label class="checkbox-line">
        <input type="checkbox" id="legalAcceptanceCheckbox" ${accepted ? "checked" : ""}>
        He leído los borradores de privacidad, términos y consentimiento cloud, y entiendo que son base para beta privada/revisión legal.
      </label>
      <div class="actions">
        <button type="button" data-action="accept-legal-docs">Guardar aceptación local</button>
        <button type="button" class="secondary" data-action="close-modal">Cerrar</button>
      </div>
    </div>
  `;
}

export function renderLegalStatusCard() {
  const acceptance = getLegalAcceptance();
  const accepted = hasAcceptedCurrentLegalVersion();
  return `
    <article class="card legal-card">
      <div class="section-title-row">
        <div>
          <h3>Privacidad y términos</h3>
          <p class="muted">Revisa los textos base antes de activar una beta con cuentas cloud o datos sensibles.</p>
        </div>
        <span class="badge ${accepted ? "success" : "warning"}">${accepted ? "Aceptado localmente" : "Pendiente"}</span>
      </div>
      <div class="mini-facts">
        <span>Versión: ${escapeHtml(LEGAL_VERSION)}</span>
        <span>${acceptance?.acceptedAt ? `Aceptado: ${escapeHtml(new Date(acceptance.acceptedAt).toLocaleString())}` : "Sin aceptación registrada"}</span>
      </div>
      <div class="actions wrap">
        <button type="button" data-action="open-legal-doc" data-legal-doc="privacy">Ver privacidad</button>
        <button type="button" class="secondary" data-action="open-legal-doc" data-legal-doc="terms">Ver términos</button>
        <button type="button" class="secondary" data-action="open-legal-doc" data-legal-doc="cloudConsent">Consentimiento cloud</button>
      </div>
    </article>
  `;
}
