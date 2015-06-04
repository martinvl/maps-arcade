function EvaluationClient(id, socket) {
    this.id = id;
    this.socket = socket;

    this.idle = false;
    this.ready = false;
    this.cur = 0;
    this.max = 0;
    this.name = "unknown";
}

module.exports = EvaluationClient;
