async function login() {

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    const message =
        document.getElementById("message");

    if (!email || !password) {

        message.innerText =
            "Please fill all fields";

        return;
    }

    try {

        const response =
            await fetch("/api/auth/login", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })

            });

        const data =
            await response.json();

        if (!response.ok) {

            message.innerText =
                data.message;

            return;
        }

        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        if (data.user.role === "teacher") {

            window.location.href =
                "teacher.html";

        } else {

            window.location.href =
                "student.html";
        }

    } catch (error) {

        console.error(error);

        message.innerText =
            "Server connection failed";
    }
}