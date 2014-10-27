function EvaluationClient(id, socket) {
    this.id = id;
    this.socket = socket;

    this.idle = false;
    this.ready = false;
}

module.exports = EvaluationClient;
