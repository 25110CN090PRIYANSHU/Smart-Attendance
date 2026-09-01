async function register() {

    const name =
        document.getElementById("name").value;

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;

    const rollNumber =
        document.getElementById("rollNumber").value;

    const message =
        document.getElementById("message");

    if (!name || !email || !password) {

        message.innerText =
            "Please fill all required fields";

        return;
    }

    try {

        const response =
            await fetch(
                "/api/auth/register",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        name,
                        email,
                        password,
                        role,
                        rollNumber

                    })

                }
            );

        const data =
            await response.json();

        message.innerText =
            data.message;

        if (response.ok) {

            setTimeout(() => {

                window.location.href =
                    "index.html";

            }, 1000);

        }

    } catch (error) {

        console.error(error);

        message.innerText =
            "Server error";
    }
}