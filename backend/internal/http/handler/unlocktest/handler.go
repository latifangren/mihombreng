package unlocktest

import (
	"net/http"

	unlockservice "mihombreng/internal/service/unlocktest"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *unlockservice.Service
}

func NewHandler(service *unlockservice.Service) *Handler {
	return &Handler{
		service: service,
	}
}

// GetTargets List targets
// @Summary List unlock test targets
// @Description Get list of configured connectivity test target services
// @Tags UnlockTest
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /unlock-test/targets [get]
func (h *Handler) GetTargets(c *gin.Context) {
	targets := h.service.GetTargets()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    targets,
	})
}

type RunTestInput struct {
	TargetID string `json:"target_id" form:"target_id"`
}

// RunTest Run test for target
// @Summary Run connectivity test
// @Description Run connectivity / unlock checks for a single target or all targets
// @Tags UnlockTest
// @Accept json
// @Produce json
// @Param input body RunTestInput false "Target ID parameters"
// @Success 200 {object} map[string]interface{}
// @Router /unlock-test/run [post]
func (h *Handler) RunTest(c *gin.Context) {
	var input RunTestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		// Fallback to query parameter or form value
		input.TargetID = c.DefaultQuery("target_id", c.PostForm("target_id"))
	}

	if input.TargetID == "" {
		results, err := h.service.RunAll(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    results,
		})
		return
	}

	res := h.service.RunTest(c.Request.Context(), input.TargetID)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    res,
	})
}
