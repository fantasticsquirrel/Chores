import type { CSSProperties } from "react";
import type { FractionAddition } from "@family-manager/family-api/discovery-models/fractions";

export function FractionAmountDiagram({
  addition,
}: {
  addition: FractionAddition;
}) {
  const wholeCount = Math.max(
    1,
    Math.ceil(addition.commonSumNumerator / addition.commonDenominator),
  );
  const mixed = addition.remainder.numerator
    ? `${addition.wholeCount} whole and ${addition.remainder.numerator}/${addition.remainder.denominator}`
    : `${addition.wholeCount} whole${addition.wholeCount === 1 ? "" : "s"}`;
  return (
    <section
      className="fraction-combined"
      role="img"
      aria-label={`Exact common-denominator model: ${addition.left.numerator}/${addition.left.denominator} is ${addition.leftCommonNumerator}/${addition.commonDenominator}; ${addition.right.numerator}/${addition.right.denominator} is ${addition.rightCommonNumerator}/${addition.commonDenominator}; together ${addition.commonSumNumerator}/${addition.commonDenominator}, or ${mixed}.`}
    >
      <div className="fraction-combined-equation">
        <span>Exact common denominator</span>
        <strong>
          {addition.leftCommonNumerator}/{addition.commonDenominator} +{" "}
          {addition.rightCommonNumerator}/{addition.commonDenominator} ={" "}
          {addition.commonSumNumerator}/{addition.commonDenominator}
        </strong>
        <small>{mixed}</small>
      </div>
      <div
        className="fraction-whole-bars"
        style={
          {
            "--fraction-columns": addition.commonDenominator,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        {Array.from({ length: wholeCount }, (_, whole) => (
          <div key={whole}>
            <div className="fraction-whole-track">
              {Array.from(
                { length: addition.commonDenominator },
                (_, piece) => (
                  <i
                    key={piece}
                    data-selected={
                      whole * addition.commonDenominator + piece <
                      addition.commonSumNumerator
                    }
                  />
                ),
              )}
            </div>
            <small>whole {whole + 1}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
