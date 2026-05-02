## Bias Audit Summary: ProPublica COMPAS Recidivism Dataset

**To:** Data Scientists, ML Engineers
**From:** AI Ethics and Fairness Expert
**Date:** October 26, 2023
**Subject:** Bias Analysis and Remediation Recommendations for COMPAS Recidivism Prediction Model

This report summarizes the findings of a bias audit performed on the ProPublica COMPAS recidivism dataset using `sisa.py` and `retune.py`. The analysis reveals significant biases related to protected attributes (`Sex_Code_Text` and `Ethnic_Code_Text`), which are critical concerns for models deployed in the criminal justice system.

The baseline model achieved an accuracy of 0.8333, but this aggregate metric masks severe disparities in how the model operates across different demographic groups.

### 1. Detected Biases and Their Significance

The audit flagged both **Disparate Impact** and **Equal Opportunity** violations:

*   **[HIGH] Disparate Impact (Sex_Code_Text and Ethnic_Code_Text):**
    *   Both `Sex_Code_Text` and `Ethnic_Code_Text` show a `disparate_impact_ratio` of `0.0`, falling significantly below the `0.8` (80%) threshold.
    *   **What this means:** The disparate impact ratio measures the ratio of the positive prediction rate (e.g., predicted to recidivate) for an unprivileged group to that of a privileged group. A ratio of `0.0` indicates an extreme disparity: one group either *never* receives a positive prediction, or the other group *always* does, leading to a complete absence of positive predictions for one of the groups when compared to another. This is a severe form of inequity, implying that the model is making fundamentally different types of predictions for individuals based purely on their sex or ethnicity.
    *   **Why it matters:** In a criminal justice context, such an extreme disparity could mean that an entire demographic group is systematically miscategorized for risk. For instance, if a group is *never* predicted to recidivate, they might receive excessively lenient sentences or supervision, potentially endangering public safety. Conversely, if a group is *never* predicted to be low-risk, they face disproportionately harsh judicial outcomes, leading to unfair incarceration, denial of parole, or intensified surveillance. This directly undermines the principle of equal treatment under the law.

*   **[MEDIUM] Equal Opportunity Difference (Sex_Code_Text and Ethnic_Code_Text):**
    *   `Sex_Code_Text` shows an `equal_opportunity_diff` of `0.1046`, exceeding the `0.1` threshold.
    *   `Ethnic_Code_Text` shows an `equal_opportunity_diff` of `0.1087`, exceeding the `0.1` threshold.
    *   **What this means:** Equal Opportunity measures whether the true positive rates (recall) are similar across different groups for the positive outcome (e.g., actual recidivism). A difference above the threshold indicates that the model is better at correctly identifying individuals who *will* recidivate in one group than in another.
    *   **Why it matters:** In criminal justice, if a model has a higher true positive rate for one group, it means it's more accurate at catching "true positives" (e.g., individuals who genuinely will recidivate) for that group. This disparity can lead to different levels of intervention and support. For the group with a lower true positive rate, the system might miss opportunities for intervention or wrongly assume lower risk, leading to ineffective or unfair outcomes. Conversely, for the group with a higher true positive rate, there might be an overemphasis on identifying individuals at risk, potentially leading to increased scrutiny even when not warranted equally across groups.

### 2. Parameter Tuning Recommendations

The `retune.py` engine suggests specific parameter adjustments to address the detected biases, primarily through techniques that adjust how the model learns from and weights different parts of the training data:

*   **`CANDIDATE_SCORE` 0.75 -> 0.5:**
    *   **Reasoning:** This parameter, likely related to identifying "unlearnable" or problematic samples, has been lowered. By setting it to `0.5`, the model becomes less stringent in what it considers a "high-confidence privileged-group prediction" for the purpose of unlearning or down-weighting. This allows the bias mitigation process to capture and adjust for a broader range of potentially biased predictions originating from the privileged group, thereby helping to narrow `DemographicParityDifference` and improve `DisparateImpactRatio`.

*   **`MAX_UNLEARN_PCT` 0.05 -> 0.12:**
    *   **Reasoning:** The increase in `MAX_UNLEARN_PCT` from `0.05` to `0.12` is a direct, more aggressive response to the presence of multiple `HIGH` and `MEDIUM` bias flags. Allowing a larger percentage of training samples to be "unlearned" (or strategically weighted/removed) enables the bias mitigation algorithm to intervene more substantially in the training process. This helps to counteract entrenched biases by forcing the model to re-evaluate its reliance on features that correlate with protected attributes and lead to discriminatory outcomes.

*   **`C` 1.0 -> 0.1:**
    *   **Reasoning:** `C` is typically the inverse of the regularization strength in many machine learning models (e.g., Logistic Regression, SVM). By decreasing `C` from `1.0` to `0.1`, we are *increasing* the strength of L2 regularization. Stronger regularization penalizes large coefficient values, effectively simplifying the model and reducing its reliance on individual features. This is crucial for fairness, as it can prevent the model from overfitting to and disproportionately relying on features that are highly correlated with (or act as proxies for) protected attributes, thus making the model's predictions less dependent on `Sex_Code_Text` or `Ethnic_Code_Text`.

*   **`class_weight` None -> 'balanced':**
    *   **Reasoning:** Setting `class_weight` to `'balanced'` in classification algorithms (e.g., Logistic Regression, Support Vector Machines, Gradient Boosting) automatically adjusts weights inversely proportional to class frequencies. This ensures that the model gives equal importance to samples from minority classes during training, preventing the model from becoming biased towards the majority class. While primarily addressing class imbalance, it also tends to narrow positive-prediction-rate gaps across different groups, which is beneficial given the severe `disparate_impact_ratio` observed.

*   **Other Recommended Parameters:** `S = 5`, `R = 5` (These typically relate to cross-validation folds or ensemble iterations, which enhance robustness and provide more stable fairness estimates, though their specific rationale isn't detailed here.)

### 3. Code-Level Fix Recommendations

The `sisa.py` pipeline has identified three priority levels for code-level interventions to address the detected biases:

*   **Priority 1: Reweighting (Pre-processing/In-processing)**
    *   **Recommendation:** Apply per-(class, group) sample weights.
    *   **Reasoning:** This directly tackles the severe `disparate_impact_ratio` by ensuring that the model's optimizer processes a balanced representation of each protected group within each target class. By assigning higher weights to underrepresented (class, group) combinations and lower weights to overrepresented ones, the model is prevented from learning skewed decision boundaries that lead to unequal positive prediction rates across different sexes and ethnicities. This directly promotes `Demographic Parity` during training.

*   **Priority 3: Threshold Adjustment (Post-processing)**
    *   **Recommendation:** Calibrate a separate classification threshold per group on a validation set to equalize positive prediction rates at inference time.
    *   **Reasoning:** This technique is a practical and computationally efficient way to address disparities in positive prediction rates *after* a model has been trained. Given the `0.0` `disparate_impact_ratio` for both sex and ethnicity, it's clear the model's single global threshold is failing drastically. By finding unique thresholds for each group, we can adjust the sensitivity for each group individually, aiming to achieve comparable positive prediction rates (e.g., equalizing the proportion of individuals predicted to recidivate) across different sexes and ethnicities, thereby promoting `Demographic Parity` at the point of decision.

*   **Priority 4: Fairness Constraints (In-processing)**
    *   **Recommendation:** Use Fairlearn's `ExponentiatedGradient` with a `DemographicParity` constraint to enforce fairness directly during training.
    *   **Reasoning:** This is a powerful, more integrated approach to fairness. Fairlearn's `ExponentiatedGradient` is an algorithm wrapper that takes an existing machine learning estimator and repeatedly trains it while adjusting sample weights. When combined with a `DemographicParity` constraint, it explicitly optimizes the model to equalize the positive prediction rate across specified protected groups (`Sex_Code_Text`, `Ethnic_Code_Text`) *during the training process itself*. This proactive approach is highly effective in mitigating severe `disparate_impact_ratio` issues by embedding fairness directly into the model's learning objective.

### Conclusion

The audit highlights significant, unacceptable levels of bias in the COMPAS dataset's use, particularly regarding disparate impact and equal opportunity for sex and ethnicity. The recommended parameter tunings and code-level fixes offer a multi-pronged approach—from pre-processing data adjustments and in-processing algorithmic changes to post-processing threshold calibration—all aimed at promoting a more equitable predictive model. Implementing these recommendations is crucial for developing a system that adheres to ethical standards and mitigates real-world harm in the criminal justice system.

---

### Further Reading

1.  **Machine Bias: Risk Assessments in Criminal Sentencing**
    *   Angwin, J., Larson, J., Mattu, S., & Kirchner, L. (2016, May 23). ProPublica.
    *   [https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing](https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing)

2.  **A Technical Response to "Machine Bias: There's (Still) No Such Thing as a Free Lunch"**
    *   Equivant. (2016).
    *   [https://www.equivant.com/propublica-compas-rebuttal/](https://www.equivant.com/propublica-compas-rebuttal/)

3.  **Fair prediction with disparate impact: A study of bias in recidivism prediction instruments**
    *   Chouldechova, A. (2017). *Big Data, 5*(2), 153-163.
    *   [https://arxiv.org/abs/1611.08259](https://arxiv.org/abs/1611.08259)

4.  **The Measure and Mismeasure of Fairness: A Critical Review of Fair Machine Learning**
    *   Corbett-Davies, S., & Goel, S. (2018).
    *   [https://arxiv.org/abs/1711.08477](https://arxiv.org/abs/1711.08477)

5.  **Algorithmic Impact Assessments: A Practical Framework for Public Agency Accountability**
    *   AI Now Institute. (2018).
    *   [https://ainowinstitute.org/aiaframework.pdf](https://ainowinstitute.org/aiaframework.pdf)