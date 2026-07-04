function $(selector) {
  return document.querySelector(selector);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function showResult(message, type = "success") {
  const result = $("#resetResult");
  result.textContent = message;
  result.className = `reset-result ${type}`;
}

$("#resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "전송 중";

  try {
    const response = await fetch("/api/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "임시 비밀번호를 전송하지 못했습니다.");
    const message = `${payload.message} 로컬 테스트에서는 data/mail-outbox.json에서 임시 비밀번호를 확인할 수 있습니다.`;
    showResult(message, "success");
    showToast(payload.message);
    alert(payload.message);
    form.reset();
  } catch (error) {
    showResult(error.message, "error");
    showToast(error.message);
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "임시 비밀번호 전송";
  }
});
