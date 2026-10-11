/**
 * YatraOne Fare & Revenue Allocation Engine
 * Implements Proportional Revenue Sharing and the Largest-Remainder (Hamilton-Hare) Method
 * to guarantee that individual operator payouts sum exactly to the unified ticket price in paise.
 */

/**
 * Calculates unified fare and proportional allocations using the Largest-Remainder method.
 * @param {Array<{ operator: string, fare: number }>} operatorFares 
 * @param {number} unifiedDiscount 
 * @returns {object} Fare summary and exact allocations
 */
export function calculateUnifiedFare(operatorFares, unifiedDiscount = 0.0) {
  // Group fares by operator
  const standaloneByOperator = {};
  for (const item of operatorFares) {
    standaloneByOperator[item.operator] = (standaloneByOperator[item.operator] || 0) + item.fare;
  }

  const operators = Object.keys(standaloneByOperator);
  const totalStandalone = operators.reduce((sum, op) => sum + standaloneByOperator[op], 0);

  // If no fare or 0, return zeroed breakdown
  if (totalStandalone <= 0) {
    return {
      totalStandalone: 0,
      discount: 0,
      unifiedPrice: 0,
      allocations: operators.map(op => ({
        operator: op,
        standalone: 0,
        sharePercentage: 0,
        allocation: 0,
        allocationPaise: 0
      })),
      formulaExplanation: "Total standalone fare is ₹0.00."
    };
  }

  // T = F_total - unified_discount (never below 0)
  const unifiedPrice = Math.max(0, totalStandalone - unifiedDiscount);
  const totalUnifiedPaise = Math.round(unifiedPrice * 100);

  // Proportional allocation via Largest-Remainder (Hamilton-Hare) Method
  // Step 1: Calculate raw proportional share and fractional remainders in paise
  const shares = operators.map(op => {
    const standalone = standaloneByOperator[op];
    const rawRatio = standalone / totalStandalone;
    const exactPaise = rawRatio * totalUnifiedPaise;
    const basePaise = Math.floor(exactPaise);
    const remainder = exactPaise - basePaise;

    return {
      operator: op,
      standalone,
      sharePercentage: (rawRatio * 100).toFixed(2),
      basePaise,
      remainder,
      exactPaise
    };
  });

  // Step 2: Sum base paise and find the leftover paise to distribute
  const sumBasePaise = shares.reduce((acc, s) => acc + s.basePaise, 0);
  let surplusPaise = totalUnifiedPaise - sumBasePaise;

  // Step 3: Sort by largest fractional remainder descending
  const sortedByRemainder = [...shares].sort((a, b) => b.remainder - a.remainder);

  // Step 4: Allocate 1 paisa to highest remainders until surplus is zero
  const allocatedPaiseMap = {};
  for (const item of sortedByRemainder) {
    allocatedPaiseMap[item.operator] = item.basePaise + (surplusPaise > 0 ? 1 : 0);
    if (surplusPaise > 0) surplusPaise--;
  }

  // Step 5: Format final allocation
  const allocations = operators.map(op => {
    const paise = allocatedPaiseMap[op];
    const allocation = paise / 100;
    return {
      operator: op,
      standalone: Number(standaloneByOperator[op].toFixed(2)),
      sharePercentage: ((standaloneByOperator[op] / totalStandalone) * 100).toFixed(2),
      allocation: Number(allocation.toFixed(2)),
      allocationPaise: paise
    };
  });

  // Verify exact sum check
  const sumAllocations = Number(allocations.reduce((sum, a) => sum + a.allocation, 0).toFixed(2));
  const exactSumMatches = Math.abs(sumAllocations - unifiedPrice) < 0.0001;

  // Explanation string
  const formulaExplanation = unifiedDiscount > 0
    ? `Simulation only: sample fares of ₹${totalStandalone.toFixed(2)} minus a hypothetical ₹${unifiedDiscount.toFixed(2)} discount gives ₹${unifiedPrice.toFixed(2)}.`
    : `Prototype estimate: local sample fare values are added by operator to ₹${totalStandalone.toFixed(2)}. This is not an official fare quote.`;

  return {
    totalStandalone: Number(totalStandalone.toFixed(2)),
    discount: Number(unifiedDiscount.toFixed(2)),
    unifiedPrice: Number(unifiedPrice.toFixed(2)),
    allocations,
    sumAllocations,
    exactSumMatches,
    formulaExplanation
  };
}

/**
 * Runs 100 random unit test combinations of fares to verify PRD Section 14 quality bar.
 * @returns {{ passed: boolean, testCount: number, errors: string[] }}
 */
export function runLargestRemainderAudit() {
  const errors = [];
  const testCount = 100;

  for (let i = 0; i < testCount; i++) {
    // Generate 2 or 3 random operator fares between 3.00 and 60.00
    const ops = ['metro', 'brts', 'amts'];
    const fares = ops.map(op => ({
      operator: op,
      fare: Math.floor(Math.random() * 500 + 30) / 10 // e.g. 3.0 to 53.0
    }));

    const discount = Math.floor(Math.random() * 15 + 2); // e.g. 2 to 17
    const result = calculateUnifiedFare(fares, discount);

    if (!result.exactSumMatches) {
      errors.push(`Mismatch on test ${i}: total=${result.unifiedPrice}, sumAlloc=${result.sumAllocations}`);
    }
  }

  return {
    passed: errors.length === 0,
    testCount,
    errors
  };
}
