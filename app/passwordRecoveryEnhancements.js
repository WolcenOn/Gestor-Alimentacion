import { isCloudConfigured, requestPasswordReset, resetPassword } from "./apiClient.js";

const RESET_PARAM = "reset-password";
let resetNavigationDone = false;

function getResetToken() {
  try {
    return new URL(window.location.href).searchParams.get(RESET_PARAM)?.trim() || "";
  } catch {
    return "";
  }
}

function clearResetToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete(RESET_PARAM);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function makeButton(label, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (className) button.className = className;
  return button;
}

function buildForgotPasswordForm(loginForm) {
  const wrapper = document.createElement("div");
  wrapper.className = "help-note";

  const toggle = makeButton("¿Has olvidado tu contraseña?", "secondary");
  toggle.dataset.passwordRecoveryToggle = "true";

  const form = document.createElement("form");
  form.className = "stack-form";
  form.hidden = true;
  form.dataset.form = "cloud-forgot-password";

  const title = document.createElement("h4");
  title.textContent = "Recuperar contraseña";

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent = "Introduce el email de tu cuenta. Si existe, recibirás un enlace para elegir una nueva contraseña.";

  const label = document.createElement("label");
  label.textContent = "Email";
  const email = document.createElement("input");
  email.name = "email";
  email.type = "email";
  email.autocomplete = "email";
  email.required = true;
  label.append(email);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Enviar enlace de recuperación";
  submit.disabled = !isCloudConfigured();

  toggle.addEventListener("click", () => {
    form.hidden = !form.hidden;
    if (!form.hidden) {
      email.value = loginForm.elements.email?.value || "";
      email.focus();
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const result = await requestPasswordReset(email.value);
      alert(result?.message || "Si existe una cuenta con ese email, recibirás instrucciones para cambiar la contraseña.");
      form.reset();
      form.hidden = true;
    } catch (error) {
      alert(error.message);
    } finally {
      submit.disabled = !isCloudConfigured();
    }
  });

  form.append(title, description, label, submit);
  wrapper.append(toggle, form);
  return wrapper;
}

function buildResetPasswordForm(token, loginForm) {
  const form = document.createElement("form");
  form.className = "stack-form";
  form.dataset.form = "cloud-reset-password";

  const title = document.createElement("h4");
  title.textContent = "Elegir nueva contraseña";

  const description = document.createElement("p");
  description.className = "muted";
  description.textContent = "El enlace de recuperación es de un solo uso y caduca a los 30 minutos.";

  const passwordLabel = document.createElement("label");
  passwordLabel.textContent = "Nueva contraseña";
  const password = document.createElement("input");
  password.name = "password";
  password.type = "password";
  password.autocomplete = "new-password";
  password.required = true;
  password.minLength = 8;
  passwordLabel.append(password);

  const confirmLabel = document.createElement("label");
  confirmLabel.textContent = "Repetir contraseña";
  const confirm = document.createElement("input");
  confirm.name = "confirmPassword";
  confirm.type = "password";
  confirm.autocomplete = "new-password";
  confirm.required = true;
  confirm.minLength = 8;
  confirmLabel.append(confirm);

  const actions = document.createElement("div");
  actions.className = "actions wrap";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Cambiar contraseña";
  submit.disabled = !isCloudConfigured();

  const cancel = makeButton("Cancelar", "secondary");
  cancel.addEventListener("click", () => {
    clearResetToken();
    window.location.reload();
  });

  actions.append(submit, cancel);
  form.append(title, description, passwordLabel, confirmLabel, actions);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (password.value !== confirm.value) {
      alert("Las contraseñas no coinciden.");
      confirm.focus();
      return;
    }

    submit.disabled = true;
    try {
      const result = await resetPassword({ token, password: password.value });
      clearResetToken();
      alert(result?.message || "Contraseña actualizada correctamente.");
      window.location.reload();
    } catch (error) {
      alert(error.message);
      submit.disabled = !isCloudConfigured();
    }
  });

  loginForm.before(form);
  loginForm.hidden = true;
  const registerForm = loginForm.parentElement?.querySelector('[data-form="cloud-register"]');
  if (registerForm) registerForm.hidden = true;
}

function enhancePasswordRecovery() {
  const loginForm = document.querySelector('form[data-form="cloud-login"]');
  if (!loginForm || loginForm.dataset.passwordRecoveryEnhanced === "true") return false;

  loginForm.dataset.passwordRecoveryEnhanced = "true";
  const token = getResetToken();
  if (token) {
    buildResetPasswordForm(token, loginForm);
  } else {
    loginForm.append(buildForgotPasswordForm(loginForm));
  }
  return true;
}

function openSettingsForReset() {
  if (resetNavigationDone || !getResetToken()) return;
  const settingsButton = document.querySelector('[data-tab="settings"]');
  if (settingsButton instanceof HTMLElement) {
    resetNavigationDone = true;
    settingsButton.click();
  }
}

const observer = new MutationObserver(() => {
  openSettingsForReset();
  enhancePasswordRecovery();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", () => {
  openSettingsForReset();
  enhancePasswordRecovery();
});
