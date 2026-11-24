import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAllowRegistration } from "./registration.js";

describe("parseAllowRegistration", () => {
  it("mantém o cadastro aberto quando a variável não existe ou está vazia", () => {
    assert.equal(parseAllowRegistration(undefined), true);
    assert.equal(parseAllowRegistration(""), true);
    assert.equal(parseAllowRegistration("   "), true);
  });

  it("fecha o cadastro com valores de desligado, sem diferenciar maiúsculas", () => {
    for (const raw of ["false", "FALSE", "0", "no", "não", "nao", "off", " false "]) {
      assert.equal(parseAllowRegistration(raw), false, raw);
    }
  });

  it("deixa aberto com true ou qualquer outro valor", () => {
    assert.equal(parseAllowRegistration("true"), true);
    assert.equal(parseAllowRegistration("1"), true);
    assert.equal(parseAllowRegistration("sim"), true);
  });
});
