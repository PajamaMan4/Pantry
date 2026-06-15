**Features to add**
1. Actually, I am rethinking this one... Need to add the ability to select different units for ingredient density. Want.
-lb/gal
-g/each (unit would be for situations such as 1 egg)
-oz/each


**Bugs**
1. Explain what this bug is While verifying, lint caught a react-hooks/preserve-manual-memoization error in the (separately-modified) recipe-scaler.tsx — the React Compiler couldn't preserve a manual useMemo around planCook. I switched it to a direct computation (the compiler auto-memoizes), keeping the in-stock ✅/❌ status feature intact. Flag if you'd rather handle that differently.
