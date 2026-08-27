from app import create_app

# Build the application by calling the factory. WSGI servers (and `flask run`)
# look for a module-level variable named `app`, so we expose it here.
app = create_app()

if __name__ == "__main__":
    # This block runs ONLY when you execute `python run.py` directly. It does
    # not run when the module is merely imported (e.g. by a test or a WSGI
    # server), because then __name__ is "app"-something, not "__main__".
    #
    # debug=True enables auto-reload on file changes and a detailed traceback
    # page in the browser. Never use debug=True in production.
    app.run(debug=True, port=5000)
