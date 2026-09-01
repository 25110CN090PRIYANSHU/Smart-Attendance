function showToast(message, type = "success") {

    const oldToast =
        document.querySelector(".toast-notification");

    if (oldToast) {
        oldToast.remove();
    }

    const toast =
        document.createElement("div");

    toast.className =
        `toast-notification ${type}`;

    let icon = "✅";

    if (type === "error") {
        icon = "❌";
    }

    if (type === "warning") {
        icon = "⚠️";
    }

    if (type === "info") {
        icon = "ℹ️";
    }

    toast.innerHTML = `
        <div class="toast-icon">
            ${icon}
        </div>

        <div class="toast-content">
            <strong>
                ${
                    type.charAt(0).toUpperCase()
                    + type.slice(1)
                }
            </strong>

            <p>${message}</p>
        </div>

        <button
            class="toast-close"
            onclick="this.parentElement.remove()"
        >
            ×
        </button>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.classList.add("show");

    }, 50);

    setTimeout(() => {

        toast.classList.remove("show");

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3500);
}